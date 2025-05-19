import React, { useState } from 'react';
import './App.css';

const COINGECKO_CACHE_KEY = 'coingecko-coinlist';
const CACHE_EXPIRY_HOURS = 24;

const getCachedCoinList = async () => {
  const cachedData = localStorage.getItem(COINGECKO_CACHE_KEY);

  if (cachedData) {
    const { timestamp, data } = JSON.parse(cachedData);
    if (Date.now() - timestamp < CACHE_EXPIRY_HOURS * 3600000) {
      return data;
    }
  }

  try {
    const response = await fetch('https://api.coingecko.com/api/v3/coins/list');
    const freshData = await response.json();
    localStorage.setItem(COINGECKO_CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      data: freshData
    }));
    return freshData;
  } catch (error) {
    if (cachedData) {
      console.warn('Using expired cache due to API failure');
      return JSON.parse(cachedData).data;
    }
    throw error;
  }
};

const getCoinGeckoId = async (ticker) => {
  try {
    const coins = await getCachedCoinList();
    const lowerTicker = ticker.toLowerCase();

    const PRIORITY_COINS = {
      eth: 'ethereum',
      btc: 'bitcoin',
      xrp: 'xrp',
      sol: 'solana'
    };

    if (PRIORITY_COINS[lowerTicker]) {
      return PRIORITY_COINS[lowerTicker];
    }

    const coin = coins.find(c => c.symbol === lowerTicker);
    return coin?.id || null;
  } catch (error) {
    console.error('Failed to get CoinGecko ID:', error);
    return null;
  }
};

function App() {
  const [coins, setCoins] = useState([{ ticker: '', mcap: '', price: '' }]);
  const [assetCap, setAssetCap] = useState(0.5);
  const [totalCapital, setTotalCapital] = useState(1000);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCoinChange = (index, field, value) => {
    const newCoins = coins.map((coin, i) =>
      i === index ? { ...coin, [field]: value } : coin
    );

    if (
      newCoins[index].ticker &&
      newCoins[index].mcap &&
      newCoins[index].price &&
      index === newCoins.length - 1
    ) {
      newCoins.push({ ticker: '', mcap: '', price: '' });
    }

    setCoins(newCoins);
  };

  const addCoin = () => setCoins([...coins, { ticker: '', mcap: '', price: '' }]);

  const removeCoin = (index) => {
    if (coins.length > 1) {
      setCoins(coins.filter((_, i) => i !== index));
    }
  };

  const fetchLastCoinData = async (coin) => {
    try {
      setIsLoading(true);
      const binanceSymbol = `${coin.ticker.toUpperCase()}USDT`;
      const binanceRes = await fetch(`http://localhost:8000/binance_price?symbol=${binanceSymbol}`);
      const binanceData = await binanceRes.json();

      const coinGeckoId = await getCoinGeckoId(coin.ticker);
      if (!coinGeckoId) throw new Error('Coin not found on CoinGecko');

      const cgRes = await fetch(`http://localhost:8000/coingecko_data?coin_gecko_id=${coinGeckoId}`);
      const cgData = await cgRes.json();

      return {
        ...coin,
        price: parseFloat(binanceData.price || 0).toString(),
        mcap: parseFloat(cgData.market_data?.market_cap?.usd || 0).toString()
      };
    } catch (error) {
      console.error('Error fetching data:', error);
      return coin;
    } finally {
      setIsLoading(false);
    }
  };

  const calculate = async () => {
    try {
      setIsLoading(true);
      setError('');

      const lastIndex = coins.length - 1;
      const lastCoin = coins[lastIndex];

      let updatedCoins = [...coins];
      if (lastCoin.ticker && !lastCoin.price) {
        updatedCoins[lastIndex] = await fetchLastCoinData(lastCoin);
        setCoins(updatedCoins);
      }

      const validCoins = updatedCoins
        .filter(coin => coin.ticker)
        .map(({ ticker, mcap, price }) => ({
          ticker,
          mcap: parseFloat(mcap) || 0,
          price: parseFloat(price) || 0
        }));

      if (validCoins.length === 0) throw new Error('Please enter at least one valid coin ticker');

      const response = await fetch('http://localhost:8000/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_cap: parseFloat(assetCap), total_capital: parseFloat(totalCapital), coins: validCoins })
      });

      if (!response.ok) throw new Error('Calculation failed');
      const resultData = await response.json();

      const formattedResults = Array.isArray(resultData)
        ? resultData.map(({ ticker = '', amount = 0, zar_value = 0, percentage = 0 }) => ({
            ticker: ticker,
            amount: parseFloat(amount),
            zar_value: parseFloat(zar_value),
            percentage: parseFloat(percentage)
          }))
        : [];

      setResults(formattedResults);
    } catch (err) {
      setError(err.message);
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
      <h1>Crypto Index Fund Calculator</h1>

      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}

      <div className={`input-section ${isLoading ? 'blurred' : ''}`}>
        <div className="form-group">
          <label>Asset Cap (0-1):</label>
          <input
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={assetCap}
            onChange={(e) => setAssetCap(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Total Capital (ZAR):</label>
          <input
            type="number"
            min="0"
            step="1"
            value={totalCapital}
            onChange={(e) => setTotalCapital(e.target.value)}
          />
        </div>

        <h3>Coins</h3>
        {coins.map((coin, index) => (
          <div key={index} className="coin-input">
            <input
              type="text"
              placeholder="Ticker"
              value={coin.ticker}
              onChange={(e) => handleCoinChange(index, 'ticker', e.target.value)}
            />
            <input
              type="number"
              placeholder="Market Cap"
              min="0"
              value={coin.mcap}
              onChange={(e) => handleCoinChange(index, 'mcap', e.target.value)}
            />
            <input
              type="number"
              placeholder="Price (ZAR)"
              min="0"
              step="0.01"
              value={coin.price}
              onChange={(e) => handleCoinChange(index, 'price', e.target.value)}
            />
            <button onClick={() => removeCoin(index)} disabled={coins.length <= 1}>Remove</button>
          </div>
        ))}

        <button onClick={addCoin}>Add Coin</button>
        <button onClick={calculate} style={{ marginLeft: '10px' }} disabled={isLoading}>
          {isLoading ? 'Calculating...' : 'Calculate'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {results && (
        <div className={`results ${isLoading ? 'blurred' : ''}`}>
          <h2>Results</h2>
          <table>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Amount</th>
                <th>ZAR Value</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              {results.map((coin, index) => (
                <tr key={index}>
                  <td>{coin.ticker}</td>
                  <td>{coin.amount.toFixed(6)}</td>
                  <td>{coin.zar_value.toFixed(2)}</td>
                  <td>{coin.percentage.toFixed(4)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default App;