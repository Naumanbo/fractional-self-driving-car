// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IAutoShareVault.sol";

/**
 * @title AutoShareVault
 * @author Michigan Blockchain Education Cohort
 * @notice A dApp for fractional ownership of self-driving vehicles
 * @dev Users buy shares of vehicles and receive proportional earnings from rides
 */
contract AutoShareVault is IAutoShareVault, ReentrancyGuard, Ownable {
    
    // ============================================================
    //                         STATE VARIABLES
    // ============================================================

    /// @notice Scaling factor for earnings calculations (prevents rounding errors)
    uint256 private constant PRECISION = 1e18;

    /// @notice Counter for vehicle IDs (starts at 1, 0 means non-existent)
    uint256 public vehicleCount;

    /// @notice Mapping from vehicle ID to Vehicle struct
    mapping(uint256 => Vehicle) public vehicles;

    /// @notice Mapping from vehicle ID => user address => Shareholder data
    mapping(uint256 => mapping(address => Shareholder)) public shareholders;

    /// @notice Array of all vehicle IDs for enumeration
    uint256[] public vehicleIds;

    // ============================================================
    //                         CONSTRUCTOR
    // ============================================================

    /**
     * @notice Initializes the contract with the deployer as owner
     */
    constructor() Ownable(msg.sender) {
        // Owner is set automatically by Ownable
    }

    // ============================================================
    //                       ADMIN FUNCTIONS
    // ============================================================

    /**
     * @notice Adds a new vehicle to the fleet
     * @param _name Display name of the vehicle (e.g., "Tesla Model 3 Alpha-001")
     * @param _imageURI URL to the vehicle's image
     * @param _totalShares Total number of shares available (e.g., 1000)
     * @param _pricePerShare Price in wei for each share (e.g., 0.01 ether)
     * @return vehicleId The ID of the newly created vehicle
     */
    function addVehicle(
        string calldata _name,
        string calldata _imageURI,
        uint256 _totalShares,
        uint256 _pricePerShare
    ) external onlyOwner returns (uint256 vehicleId) {
        // Validate inputs
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(_totalShares > 0, "Total shares must be positive");
        require(_pricePerShare > 0, "Price must be positive");

        // Increment counter first (IDs start at 1)
        vehicleCount++;
        vehicleId = vehicleCount;

        // Create the vehicle
        vehicles[vehicleId] = Vehicle({
            id: vehicleId,
            name: _name,
            imageURI: _imageURI,
            totalShares: _totalShares,
            availableShares: _totalShares, // All shares available initially
            pricePerShare: _pricePerShare,
            totalEarnings: 0,
            totalExpenses: 0,
            earningsPerShare: 0,
            isActive: true,
            createdAt: block.timestamp
        });

        // Add to ID array for enumeration
        vehicleIds.push(vehicleId);

        emit VehicleAdded(vehicleId, _name, _totalShares, _pricePerShare);

        return vehicleId;
    }

    /**
     * @notice Deposits ride earnings for a vehicle (distributes to shareholders)
     * @dev Earnings are distributed proportionally based on shares owned
     * @param _vehicleId The ID of the vehicle receiving earnings
     */
    function depositEarnings(uint256 _vehicleId) external payable onlyOwner {
        require(msg.value > 0, "Must deposit some earnings");
        
        Vehicle storage vehicle = vehicles[_vehicleId];
        require(vehicle.id != 0, "Vehicle does not exist");

        // Calculate how many shares are currently sold
        uint256 soldShares = vehicle.totalShares - vehicle.availableShares;
        require(soldShares > 0, "No shares sold yet");

        // Update earnings per share (scaled by PRECISION for accuracy)
        // Formula: new_earnings_per_share = amount * PRECISION / sold_shares
        vehicle.earningsPerShare += (msg.value * PRECISION) / soldShares;
        vehicle.totalEarnings += msg.value;

        emit EarningsDeposited(_vehicleId, msg.value, vehicle.earningsPerShare);
    }

    /**
     * @notice Records an expense for a vehicle (informational only in MVP)
     * @dev In a full version, this would deduct from earnings before distribution
     * @param _vehicleId The ID of the vehicle
     * @param _amount The expense amount in wei
     * @param _description Description of the expense
     */
    function recordExpense(
        uint256 _vehicleId,
        uint256 _amount,
        string calldata _description
    ) external onlyOwner {
        Vehicle storage vehicle = vehicles[_vehicleId];
        require(vehicle.id != 0, "Vehicle does not exist");

        vehicle.totalExpenses += _amount;

        emit ExpenseRecorded(_vehicleId, _amount, _description);
    }

    /**
     * @notice Pauses or unpauses a vehicle (affects buying/selling)
     * @param _vehicleId The ID of the vehicle
     * @param _isActive Whether the vehicle should be active
     */
    function setVehicleStatus(uint256 _vehicleId, bool _isActive) external onlyOwner {
        Vehicle storage vehicle = vehicles[_vehicleId];
        require(vehicle.id != 0, "Vehicle does not exist");

        vehicle.isActive = _isActive;

        emit VehicleStatusChanged(_vehicleId, _isActive);
    }

    /**
     * @notice Allows owner to withdraw contract balance (for expenses, etc.)
     * @dev In production, this would have more restrictions
     */
    function withdrawFunds(uint256 _amount) external onlyOwner {
        require(_amount <= address(this).balance, "Insufficient balance");
        
        (bool success, ) = payable(owner()).call{value: _amount}("");
        require(success, "Transfer failed");

        emit FundsWithdrawn(owner(), _amount);
    }

    // ============================================================
    //                        USER FUNCTIONS
    // ============================================================

    /**
     * @notice Purchase shares of a vehicle
     * @param _vehicleId The ID of the vehicle
     * @param _amount Number of shares to purchase
     */
    function buyShares(uint256 _vehicleId, uint256 _amount) external payable nonReentrant {
        Vehicle storage vehicle = vehicles[_vehicleId];
        
        // Validations
        require(vehicle.id != 0, "Vehicle does not exist");
        require(vehicle.isActive, "Vehicle is not active");
        require(_amount > 0, "Amount must be positive");
        require(_amount <= vehicle.availableShares, "Not enough shares available");
        
        uint256 totalCost = _amount * vehicle.pricePerShare;
        require(msg.value >= totalCost, "Insufficient payment");

        Shareholder storage shareholder = shareholders[_vehicleId][msg.sender];

        // IMPORTANT: If user already has shares, claim their pending earnings first
        // This prevents them from losing unclaimed earnings when we update their debt
        if (shareholder.shares > 0) {
            _claimEarnings(_vehicleId, msg.sender);
        }

        // Update share counts
        vehicle.availableShares -= _amount;
        shareholder.shares += _amount;

        // Set earnings debt to current level (so they can't claim past earnings)
        // This is the key to the dividend distribution mechanism
        shareholder.earningsDebt = vehicle.earningsPerShare;

        // Refund excess payment
        if (msg.value > totalCost) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - totalCost}("");
            require(success, "Refund failed");
        }

        emit SharesPurchased(_vehicleId, msg.sender, _amount, totalCost);
    }

    /**
     * @notice Sell shares back to the pool
     * @param _vehicleId The ID of the vehicle
     * @param _amount Number of shares to sell
     */
    function sellShares(uint256 _vehicleId, uint256 _amount) external nonReentrant {
        Vehicle storage vehicle = vehicles[_vehicleId];
        Shareholder storage shareholder = shareholders[_vehicleId][msg.sender];

        // Validations
        require(vehicle.id != 0, "Vehicle does not exist");
        require(vehicle.isActive, "Vehicle is not active");
        require(_amount > 0, "Amount must be positive");
        require(shareholder.shares >= _amount, "Insufficient shares");

        // Auto-claim pending earnings before selling
        _claimEarnings(_vehicleId, msg.sender);

        // Calculate payout
        uint256 payout = _amount * vehicle.pricePerShare;

        // Update share counts
        shareholder.shares -= _amount;
        vehicle.availableShares += _amount;

        // Transfer payout to seller
        (bool success, ) = payable(msg.sender).call{value: payout}("");
        require(success, "Payout failed");

        emit SharesSold(_vehicleId, msg.sender, _amount, payout);
    }

    /**
     * @notice Claim pending earnings for a vehicle
     * @param _vehicleId The ID of the vehicle
     */
    function claimEarnings(uint256 _vehicleId) external nonReentrant {
        _claimEarnings(_vehicleId, msg.sender);
    }

    /**
     * @notice Claim earnings from all vehicles the user owns shares in
     */
    function claimAllEarnings() external nonReentrant {
        uint256 totalClaimed = 0;

        for (uint256 i = 0; i < vehicleIds.length; i++) {
            uint256 vid = vehicleIds[i];
            Shareholder storage shareholder = shareholders[vid][msg.sender];
            
            if (shareholder.shares > 0) {
                uint256 claimed = _claimEarningsInternal(vid, msg.sender);
                totalClaimed += claimed;
            }
        }

        require(totalClaimed > 0, "Nothing to claim");
    }

    // ============================================================
    //                      INTERNAL FUNCTIONS
    // ============================================================

    /**
     * @notice Internal function to claim earnings (used by multiple external functions)
     * @param _vehicleId The ID of the vehicle
     * @param _user The user claiming earnings
     */
    function _claimEarnings(uint256 _vehicleId, address _user) internal {
        uint256 amount = _claimEarningsInternal(_vehicleId, _user);
        if (amount == 0) return; // No revert, just skip if nothing to claim
    }

    /**
     * @notice Internal function that does the actual earnings claim
     * @param _vehicleId The ID of the vehicle
     * @param _user The user claiming earnings
     * @return amount The amount claimed
     */
    function _claimEarningsInternal(uint256 _vehicleId, address _user) internal returns (uint256 amount) {
        Vehicle storage vehicle = vehicles[_vehicleId];
        Shareholder storage shareholder = shareholders[_vehicleId][_user];

        if (shareholder.shares == 0) return 0;

        // Calculate pending earnings
        // Formula: (current_eps - user_debt) * user_shares / PRECISION
        uint256 pending = ((vehicle.earningsPerShare - shareholder.earningsDebt) * shareholder.shares) / PRECISION;

        if (pending == 0) return 0;

        // Update debt to current level (prevents double-claiming)
        shareholder.earningsDebt = vehicle.earningsPerShare;

        // Transfer earnings
        (bool success, ) = payable(_user).call{value: pending}("");
        require(success, "Claim transfer failed");

        emit EarningsClaimed(_vehicleId, _user, pending);

        return pending;
    }

    // ============================================================
    //                       VIEW FUNCTIONS
    // ============================================================

    /**
     * @notice Get details of a specific vehicle
     * @param _vehicleId The ID of the vehicle
     * @return The Vehicle struct
     */
    function getVehicle(uint256 _vehicleId) external view returns (Vehicle memory) {
        require(vehicles[_vehicleId].id != 0, "Vehicle does not exist");
        return vehicles[_vehicleId];
    }

    /**
     * @notice Get all vehicles in the fleet
     * @return Array of all Vehicle structs
     */
    function getAllVehicles() external view returns (Vehicle[] memory) {
        Vehicle[] memory allVehicles = new Vehicle[](vehicleIds.length);
        
        for (uint256 i = 0; i < vehicleIds.length; i++) {
            allVehicles[i] = vehicles[vehicleIds[i]];
        }
        
        return allVehicles;
    }

    /**
     * @notice Get the number of shares a user owns for a vehicle
     * @param _vehicleId The ID of the vehicle
     * @param _user The user's address
     * @return Number of shares owned
     */
    function getUserShares(uint256 _vehicleId, address _user) external view returns (uint256) {
        return shareholders[_vehicleId][_user].shares;
    }

    /**
     * @notice Calculate claimable earnings for a user on a specific vehicle
     * @param _vehicleId The ID of the vehicle
     * @param _user The user's address
     * @return Claimable amount in wei
     */
    function getClaimableEarnings(uint256 _vehicleId, address _user) external view returns (uint256) {
        Vehicle storage vehicle = vehicles[_vehicleId];
        Shareholder storage shareholder = shareholders[_vehicleId][_user];

        if (shareholder.shares == 0) return 0;

        return ((vehicle.earningsPerShare - shareholder.earningsDebt) * shareholder.shares) / PRECISION;
    }

    /**
     * @notice Get a user's complete portfolio across all vehicles
     * @param _user The user's address
     * @return _vehicleIds Array of vehicle IDs the user has shares in
     * @return _shares Array of share amounts (parallel to vehicleIds)
     * @return _claimable Array of claimable amounts (parallel to vehicleIds)
     * @return _totalValue Total portfolio value in wei
     * @return _totalClaimable Total claimable earnings across all vehicles
     */
    function getUserPortfolio(address _user) 
        external 
        view 
        returns (
            uint256[] memory _vehicleIds,
            uint256[] memory _shares,
            uint256[] memory _claimable,
            uint256 _totalValue,
            uint256 _totalClaimable
        ) 
    {
        // First pass: count how many vehicles user has shares in
        uint256 count = 0;
        for (uint256 i = 0; i < vehicleIds.length; i++) {
            if (shareholders[vehicleIds[i]][_user].shares > 0) {
                count++;
            }
        }

        // Initialize return arrays
        _vehicleIds = new uint256[](count);
        _shares = new uint256[](count);
        _claimable = new uint256[](count);

        // Second pass: populate arrays
        uint256 index = 0;
        for (uint256 i = 0; i < vehicleIds.length; i++) {
            uint256 vid = vehicleIds[i];
            Shareholder storage sh = shareholders[vid][_user];
            
            if (sh.shares > 0) {
                Vehicle storage v = vehicles[vid];
                
                _vehicleIds[index] = vid;
                _shares[index] = sh.shares;
                
                // Calculate claimable
                uint256 claimableAmount = ((v.earningsPerShare - sh.earningsDebt) * sh.shares) / PRECISION;
                _claimable[index] = claimableAmount;
                
                // Add to totals
                _totalValue += sh.shares * v.pricePerShare;
                _totalClaimable += claimableAmount;
                
                index++;
            }
        }

        return (_vehicleIds, _shares, _claimable, _totalValue, _totalClaimable);
    }

    /**
     * @notice Get the total number of vehicles
     * @return Number of vehicles
     */
    function getVehicleCount() external view returns (uint256) {
        return vehicleIds.length;
    }

    /**
     * @notice Get sold shares count for a vehicle
     * @param _vehicleId The ID of the vehicle
     * @return Number of sold shares
     */
    function getSoldShares(uint256 _vehicleId) external view returns (uint256) {
        Vehicle storage vehicle = vehicles[_vehicleId];
        require(vehicle.id != 0, "Vehicle does not exist");
        return vehicle.totalShares - vehicle.availableShares;
    }

    /**
     * @notice Get contract's ETH balance
     * @return Balance in wei
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Check if an address is the contract owner
     * @param _address Address to check
     * @return True if owner
     */
    function isOwner(address _address) external view returns (bool) {
        return _address == owner();
    }

    // ============================================================
    //                       RECEIVE FUNCTION
    // ============================================================

    /**
     * @notice Allows contract to receive ETH directly (for flexibility)
     */
    receive() external payable {
        emit FundsReceived(msg.sender, msg.value);
    }
}