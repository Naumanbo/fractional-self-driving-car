// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAutoShareVault
 * @notice Interface for the AutoShareVault contract
 */
interface IAutoShareVault {
    
    // ============================================================
    //                           STRUCTS
    // ============================================================

    /**
     * @notice Represents a self-driving vehicle in the fleet
     */
    struct Vehicle {
        uint256 id;              // Unique identifier (starts at 1)
        string name;             // Display name (e.g., "Tesla Model 3 Alpha-001")
        string imageURI;         // URL to vehicle image
        uint256 totalShares;     // Total shares available (e.g., 1000)
        uint256 availableShares; // Shares not yet purchased
        uint256 pricePerShare;   // Price in wei per share
        uint256 totalEarnings;   // Cumulative earnings deposited
        uint256 totalExpenses;   // Cumulative expenses recorded
        uint256 earningsPerShare;// Scaled earnings per share (for dividend calc)
        bool isActive;           // Whether trading is enabled
        uint256 createdAt;       // Timestamp of creation
    }

    /**
     * @notice Represents a user's stake in a vehicle
     */
    struct Shareholder {
        uint256 shares;          // Number of shares owned
        uint256 earningsDebt;    // Used for dividend calculation
    }

    // ============================================================
    //                           EVENTS
    // ============================================================

    /**
     * @notice Emitted when a new vehicle is added to the fleet
     */
    event VehicleAdded(
        uint256 indexed vehicleId,
        string name,
        uint256 totalShares,
        uint256 pricePerShare
    );

    /**
     * @notice Emitted when a user purchases shares
     */
    event SharesPurchased(
        uint256 indexed vehicleId,
        address indexed buyer,
        uint256 amount,
        uint256 totalCost
    );

    /**
     * @notice Emitted when a user sells shares
     */
    event SharesSold(
        uint256 indexed vehicleId,
        address indexed seller,
        uint256 amount,
        uint256 payout
    );

    /**
     * @notice Emitted when earnings are deposited for a vehicle
     */
    event EarningsDeposited(
        uint256 indexed vehicleId,
        uint256 amount,
        uint256 newEarningsPerShare
    );

    /**
     * @notice Emitted when a user claims their earnings
     */
    event EarningsClaimed(
        uint256 indexed vehicleId,
        address indexed user,
        uint256 amount
    );

    /**
     * @notice Emitted when an expense is recorded
     */
    event ExpenseRecorded(
        uint256 indexed vehicleId,
        uint256 amount,
        string description
    );

    /**
     * @notice Emitted when vehicle status is changed
     */
    event VehicleStatusChanged(
        uint256 indexed vehicleId,
        bool isActive
    );

    /**
     * @notice Emitted when owner withdraws funds
     */
    event FundsWithdrawn(
        address indexed to,
        uint256 amount
    );

    /**
     * @notice Emitted when contract receives ETH directly
     */
    event FundsReceived(
        address indexed from,
        uint256 amount
    );

    // ============================================================
    //                      ADMIN FUNCTIONS
    // ============================================================

    /**
     * @notice Adds a new vehicle to the fleet
     */
    function addVehicle(
        string calldata _name,
        string calldata _imageURI,
        uint256 _totalShares,
        uint256 _pricePerShare
    ) external returns (uint256 vehicleId);

    /**
     * @notice Deposits ride earnings for a vehicle
     */
    function depositEarnings(uint256 _vehicleId) external payable;

    /**
     * @notice Records an expense for a vehicle
     */
    function recordExpense(
        uint256 _vehicleId,
        uint256 _amount,
        string calldata _description
    ) external;

    /**
     * @notice Pauses or unpauses a vehicle
     */
    function setVehicleStatus(uint256 _vehicleId, bool _isActive) external;

    /**
     * @notice Withdraws funds from the contract
     */
    function withdrawFunds(uint256 _amount) external;

    // ============================================================
    //                       USER FUNCTIONS
    // ============================================================

    /**
     * @notice Purchase shares of a vehicle
     */
    function buyShares(uint256 _vehicleId, uint256 _amount) external payable;

    /**
     * @notice Sell shares back to the pool
     */
    function sellShares(uint256 _vehicleId, uint256 _amount) external;

    /**
     * @notice Claim pending earnings for a vehicle
     */
    function claimEarnings(uint256 _vehicleId) external;

    /**
     * @notice Claim earnings from all vehicles
     */
    function claimAllEarnings() external;

    // ============================================================
    //                       VIEW FUNCTIONS
    // ============================================================

    /**
     * @notice Get details of a specific vehicle
     */
    function getVehicle(uint256 _vehicleId) external view returns (Vehicle memory);

    /**
     * @notice Get all vehicles in the fleet
     */
    function getAllVehicles() external view returns (Vehicle[] memory);

    /**
     * @notice Get the number of shares a user owns
     */
    function getUserShares(uint256 _vehicleId, address _user) external view returns (uint256);

    /**
     * @notice Calculate claimable earnings for a user
     */
    function getClaimableEarnings(uint256 _vehicleId, address _user) external view returns (uint256);

    /**
     * @notice Get a user's complete portfolio
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
        );

    /**
     * @notice Get the total number of vehicles
     */
    function getVehicleCount() external view returns (uint256);

    /**
     * @notice Get sold shares count for a vehicle
     */
    function getSoldShares(uint256 _vehicleId) external view returns (uint256);

    /**
     * @notice Get contract's ETH balance
     */
    function getContractBalance() external view returns (uint256);

    /**
     * @notice Check if an address is the contract owner
     */
    function isOwner(address _address) external view returns (bool);
}