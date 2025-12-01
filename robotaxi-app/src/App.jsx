import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import './App.css';

const CONTRACT_ABI = [
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_amount",
				"type": "uint256"
			}
		],
		"name": "buyShare",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "depositCarEarnings",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"inputs": [],
		"name": "IncorrectETHAmount",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "NoEarningsToWithdraw",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "NoShareholdersYet",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "SoldOut",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "TransferFailed",
		"type": "error"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "EarningsDeposited",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "buyer",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "ShareBought",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "withdrawDividends",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "owner",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "Withdrawn",
		"type": "event"
	},
	{
		"stateMutability": "payable",
		"type": "receive"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_user",
				"type": "address"
			}
		],
		"name": "getClaimable",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "lastDividendAt",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "SHARE_PRICE",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "sharesOwned",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "sharesSold",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "TOTAL_SHARES",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "totalDividendsPerShare",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "userBalance",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];

const CONTRACT_ADDRESS = "0x5D97e3a69F50d7F26F747668De423A0A8b2cb6C9"; 

// Toast notification component
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast ${type}`}>
      <div className="toast-icon">
        {type === 'success' ? '✓' : type === 'error' ? '✕' : '○'}
      </div>
      <span>{message}</span>
      <button className="toast-close" onClick={onClose}>✕</button>
    </div>
  );
};

// Modal component
const Modal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        {children}
      </div>
    </div>
  );
};

// Animated counter component
const AnimatedNumber = ({ value, decimals = 0, suffix = '' }) => {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    const numValue = parseFloat(value) || 0;
    const duration = 1000;
    const steps = 60;
    const increment = numValue / steps;
    let current = 0;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= numValue) {
        setDisplayValue(numValue);
        clearInterval(timer);
      } else {
        setDisplayValue(current);
      }
    }, duration / steps);
    
    return () => clearInterval(timer);
  }, [value]);
  
  return <span>{displayValue.toFixed(decimals)}{suffix}</span>;
};

function App() {
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('invest');
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [shareAmount, setShareAmount] = useState(1);
  const [toasts, setToasts] = useState([]);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  const [data, setData] = useState({
    myShares: 0,
    totalSold: 0,
    claimable: "0",
    price: "0.01"
  });

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', loadBlockchainData);
    }
    
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const connectWallet = async () => {
    if (window.ethereum) {
      setIsLoading(true);
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        await loadBlockchainData();
        addToast('Wallet connected successfully', 'success');
      } catch (error) {
        addToast('Failed to connect wallet', 'error');
      }
      setIsLoading(false);
    } else {
      addToast('Please install MetaMask', 'error');
    }
  };

  const loadBlockchainData = async () => {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    
    setProvider(provider);
    setAccount(signer.address);
    setContract(contract);
    refreshData(contract, signer.address);
  };

  const refreshData = async (contractObj, userAddress) => {
    try {
      const shares = await contractObj.sharesOwned(userAddress);
      const sold = await contractObj.sharesSold();
      const claimable = await contractObj.getClaimable(userAddress);
      const price = await contractObj.SHARE_PRICE();

      setData({
        myShares: shares.toString(),
        totalSold: sold.toString(),
        claimable: ethers.formatEther(claimable),
        price: ethers.formatEther(price)
      });
    } catch (e) {
      console.error("Error loading data:", e);
    }
  };

  const buyShare = async () => {
    if(!contract) return;
    setIsLoading(true);
    try {
      const priceWei = ethers.parseEther((parseFloat(data.price) * shareAmount).toString()); 
      const tx = await contract.buyShare(shareAmount, { value: priceWei });
      await tx.wait();
      addToast(`Successfully purchased ${shareAmount} share(s)!`, 'success');
      setShowBuyModal(false);
      setShareAmount(1);
      refreshData(contract, account);
    } catch (error) {
      console.error(error);
      addToast('Transaction failed. Check console for details.', 'error');
    }
    setIsLoading(false);
  };

  const withdraw = async () => {
    if(!contract) return;
    setIsLoading(true);
    try {
      const tx = await contract.withdrawDividends();
      await tx.wait();
      addToast('Earnings withdrawn successfully!', 'success');
      refreshData(contract, account);
    } catch (error) {
      console.error(error);
      addToast('Withdrawal failed', 'error');
    }
    setIsLoading(false);
  };

  const simulateCarEarnings = async () => {
    if(!contract) return;
    setIsLoading(true);
    try {
      const tx = await contract.depositCarEarnings({ value: ethers.parseEther("0.01") });
      await tx.wait();
      addToast('Revenue simulation successful!', 'success');
      refreshData(contract, account);
    } catch (error) {
      console.error(error);
      addToast('Simulation failed', 'error');
    }
    setIsLoading(false);
  };

  const progressPercentage = (parseInt(data.totalSold) / 100) * 100;

  return (
    <div className="app-container">
      {/* Background grid effect */}
      <div className="grid-background"></div>
      
      {/* Cursor glow effect */}
      <div 
        className="cursor-glow"
        style={{ 
          left: mousePosition.x, 
          top: mousePosition.y 
        }}
      ></div>

      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map(toast => (
          <Toast 
            key={toast.id} 
            message={toast.message} 
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>

      <header>
        <div className="logo">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="logo-text">RoboFund</span>
        </div>
        
        <nav className="nav-tabs">
          <button 
            className={`nav-tab ${activeTab === 'invest' ? 'active' : ''}`}
            onClick={() => setActiveTab('invest')}
          >
            Invest
          </button>
          <button 
            className={`nav-tab ${activeTab === 'portfolio' ? 'active' : ''}`}
            onClick={() => setActiveTab('portfolio')}
          >
            Portfolio
          </button>
          <button 
            className={`nav-tab ${activeTab === 'demo' ? 'active' : ''}`}
            onClick={() => setActiveTab('demo')}
          >
            Demo
          </button>
        </nav>

        {!account ? (
          <button onClick={connectWallet} className="connect-btn" disabled={isLoading}>
            <span className="btn-content">
              {isLoading ? (
                <span className="spinner"></span>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="wallet-icon">
                    <rect x="2" y="6" width="20" height="14" rx="2"/>
                    <path d="M16 14a2 2 0 100-4 2 2 0 000 4z"/>
                    <path d="M2 10h20"/>
                  </svg>
                  Connect
                </>
              )}
            </span>
          </button>
        ) : (
          <div className="account-badge">
            <div className="account-dot"></div>
            <span>{account.slice(0,6)}...{account.slice(-4)}</span>
          </div>
        )}
      </header>

      <main>
        {activeTab === 'invest' && (
          <section className="invest-section">
            <div className="glass-card featured-card">
              <div className="card-header">
                <div className="status-badge">
                  <span className="pulse-dot"></span>
                  LIVE
                </div>
                <div className="card-actions">
                  <button className="icon-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
                      <polyline points="16,6 12,2 8,6"/>
                      <line x1="12" y1="2" x2="12" y2="15"/>
                    </svg>
                  </button>
                  <button className="icon-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div className="vehicle-display">
                <img 
                    src="/Model_3.png" 
                    alt="Tesla Model 3" 
                    style={{ 
                      width: '100%', 
                      height: '200px',       /* Fixed height keeps layout stable */
                      objectFit: 'contain',    /* Crops the image nicely if dimensions are weird */
                      borderRadius: '12px',  /* Rounded corners */
                      marginBottom: '16px',  /* Space between image and text */
                      border: '1px solid rgba(255,255,255,0.1)' /* Subtle border */
                    }} 
                  />
                <h2>Tesla Model 3</h2>
                <p className="vehicle-location">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  Detroit, Michigan
                </p>
              </div>

              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">Shares Sold</span>
                  <span className="stat-value">
                    <AnimatedNumber value={data.totalSold} /> / 100
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Share Price</span>
                  <span className="stat-value">
                    <AnimatedNumber value={data.price} decimals={4} suffix=" ETH" />
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Est. APY</span>
                  <span className="stat-value highlight">12.5%</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Total Value</span>
                  <span className="stat-value">1.0 ETH</span>
                </div>
              </div>

              <div className="progress-section">
                <div className="progress-header">
                  <span>Funding Progress</span>
                  <span>{progressPercentage.toFixed(0)}%</span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
              </div>

              <button 
                onClick={() => setShowBuyModal(true)} 
                className="primary-btn"
                disabled={!account || isLoading}
              >
                {!account ? 'Connect Wallet to Invest' : 'Buy Shares'}
              </button>
            </div>

            <div className="info-cards">
              <div className="glass-card mini-card">
                <div className="mini-card-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <h4>Secure</h4>
                <p>Smart contract audited & verified on-chain</p>
              </div>
              <div className="glass-card mini-card">
                <div className="mini-card-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12,6 12,12 16,14"/>
                  </svg>
                </div>
                <h4>Automated</h4>
                <p>Passive income from autonomous operations</p>
              </div>
              <div className="glass-card mini-card">
                <div className="mini-card-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="1" x2="12" y2="23"/>
                    <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                  </svg>
                </div>
                <h4>Dividends</h4>
                <p>Earn proportional share of all revenue</p>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'portfolio' && (
          <section className="portfolio-section">
            <div className="glass-card">
              <h2>Your Portfolio</h2>
              
              <div className="portfolio-stats">
                <div className="portfolio-stat large">
                  <span className="stat-label">Your Shares</span>
                  <span className="stat-value big">
                    <AnimatedNumber value={data.myShares} />
                  </span>
                  <span className="stat-sub">
                    {((parseInt(data.myShares) / 100) * 100).toFixed(1)}% ownership
                  </span>
                </div>
                
                <div className="portfolio-stat large">
                  <span className="stat-label">Unclaimed Earnings</span>
                  <span className="stat-value big">
                    <AnimatedNumber value={data.claimable} decimals={6} suffix=" ETH" />
                  </span>
                  <span className="stat-sub">Ready to withdraw</span>
                </div>
              </div>

              <div className="ownership-visual">
                <div className="ownership-bar">
                  <div 
                    className="ownership-fill"
                    style={{ width: `${(parseInt(data.myShares) / 100) * 100}%` }}
                  ></div>
                </div>
                <div className="ownership-labels">
                  <span>Your shares: {data.myShares}</span>
                  <span>Others: {100 - parseInt(data.myShares)}</span>
                </div>
              </div>

              <div className="action-buttons">
                <button 
                  onClick={withdraw} 
                  disabled={parseFloat(data.claimable) === 0 || isLoading}
                  className="secondary-btn"
                >
                  {isLoading ? (
                    <span className="spinner"></span>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                        <polyline points="7,10 12,15 17,10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Withdraw Earnings
                    </>
                  )}
                </button>
                <button 
                  onClick={() => { setActiveTab('invest'); setShowBuyModal(true); }}
                  className="outline-btn"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Buy More Shares
                </button>
              </div>
            </div>

            <div className="glass-card">
              <h3>Recent Activity</h3>
              <div className="activity-list">
                <div className="activity-item">
                  <div className="activity-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/>
                    </svg>
                  </div>
                  <div className="activity-info">
                    <span className="activity-title">Revenue Generated</span>
                    <span className="activity-time">Waiting for events...</span>
                  </div>
                  <span className="activity-amount">+0.00 ETH</span>
                </div>
                <div className="activity-empty">
                  <p>Transaction history will appear here</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'demo' && (
          <section className="demo-section">
            <div className="glass-card">
              <div className="demo-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="demo-icon">
                  <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/>
                </svg>
                <h2>Demo Mode</h2>
                <p>Simulate autonomous vehicle revenue to test dividend distribution</p>
              </div>

              <div className="demo-controls">
                <div className="demo-card">
                  <h4>Simulate Car Earnings</h4>
                  <p>This deposits 0.01 ETH into the contract as if the car completed a ride</p>
                  <button 
                    onClick={simulateCarEarnings} 
                    className="demo-btn"
                    disabled={!account || isLoading}
                  >
                    {isLoading ? (
                      <span className="spinner"></span>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="5,3 19,12 5,21 5,3"/>
                        </svg>
                        Generate Revenue (+0.01 ETH)
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="demo-info">
                <h4>How it works</h4>
                <ol>
                  <li>Purchase shares to become a shareholder</li>
                  <li>Simulate revenue (or wait for real autonomous earnings)</li>
                  <li>Claim your proportional share of dividends</li>
                </ol>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer>
        <div className="footer-content">
          <span>RoboFund Protocol</span>
          <div className="footer-links">
            <a href="#" className="footer-link">Docs</a>
            <a href="#" className="footer-link">GitHub</a>
            <a href="#" className="footer-link">Discord</a>
          </div>
        </div>
      </footer>

      {/* Buy Modal */}
      <Modal isOpen={showBuyModal} onClose={() => setShowBuyModal(false)}>
        <div className="buy-modal">
          <h2>Purchase Shares</h2>
          <p>Select the number of shares you want to purchase</p>
          
          <div className="share-selector">
            <button 
              className="selector-btn"
              onClick={() => setShareAmount(Math.max(1, shareAmount - 1))}
            >
              −
            </button>
            <div className="share-display">
              <span className="share-count">{shareAmount}</span>
              <span className="share-label">shares</span>
            </div>
            <button 
              className="selector-btn"
              onClick={() => setShareAmount(Math.min(100 - parseInt(data.totalSold), shareAmount + 1))}
            >
              +
            </button>
          </div>

          <div className="purchase-summary">
            <div className="summary-row">
              <span>Price per share</span>
              <span>{data.price} ETH</span>
            </div>
            <div className="summary-row">
              <span>Quantity</span>
              <span>{shareAmount}</span>
            </div>
            <div className="summary-row total">
              <span>Total</span>
              <span>{(parseFloat(data.price) * shareAmount).toFixed(4)} ETH</span>
            </div>
          </div>

          <button 
            onClick={buyShare}
            className="primary-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="spinner"></span>
            ) : (
              `Confirm Purchase`
            )}
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default App;