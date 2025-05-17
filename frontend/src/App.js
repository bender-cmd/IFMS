import React, {useState} from 'react';
import './App.css';

// Add this outside your component (top of file)
const COINGECKO_CACHE_KEY = 'coingecko-coinlist';
const CACHE_EXPIRY_HOURS = 24; // Cache coin list for 24 hours

// Cached coin list fetcher
const getCachedCoinList = async () => {
	// 1. Check cache
	const cachedData = localStorage.getItem(COINGECKO_CACHE_KEY);

	if (cachedData) {
		const {timestamp, data} = JSON.parse(cachedData);

		// Return cached data if not expired
		if (Date.now() - timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000) {
			return data;
		}
	}

	// 2. Fetch fresh data
	try {
		const response = await fetch('https://api.coingecko.com/api/v3/coins/list');
		const freshData = await response.json();

		// Update cache with timestamp
		localStorage.setItem(COINGECKO_CACHE_KEY, JSON.stringify({
			timestamp: Date.now(),
			data: freshData
		}));

		return freshData;
	} catch (error) {
		// Fallback to cache even if expired when API fails
		if (cachedData) {
			console.warn('Using expired cache due to API failure');
			return JSON.parse(cachedData).data;
		}
		throw error;
	}
};

// Main mapping function
const getCoinGeckoId = async (ticker) => {
	try {
		const coins = await getCachedCoinList();
		const coin = coins.find(c => c.symbol === ticker.toLowerCase());
		return coin?.id || null;
	} catch (error) {
		console.error('Failed to get CoinGecko ID:', error);
		return null;
	}
};

function App() {
	const [coins, setCoins] = useState([{ticker: '', mcap: '', price: ''}]);
	const [assetCap, setAssetCap] = useState(0.5);
	const [totalCapital, setTotalCapital] = useState(1000);
	const [results, setResults] = useState(null);
	const [error, setError] = useState('');

	const handleCoinChange = (index, field, value) => {
		const newCoins = [...coins];
		newCoins[index][field] = value;
		setCoins(newCoins);

		// Check if entire row is filled
		const currentCoin = newCoins[index];
		const isRowFilled = currentCoin.ticker && currentCoin.mcap && currentCoin.price;

		// If true and it's the last row, add new blank row
		if (isRowFilled && index === newCoins.length - 1) {
			setCoins([...newCoins, {ticker: '', mcap: '', price: ''}]);
		}
	};

	const addCoin = () => {
		setCoins([...coins, {ticker: '', mcap: '', price: ''}]);
	};

	const removeCoin = (index) => {
		if (coins.length <= 1) return;
		const newCoins = [...coins];
		newCoins.splice(index, 1);
		setCoins(newCoins);
	};

	const calculate = async () => {
		try {
			const updatedCoins = [...coins];
			const lastIndex = updatedCoins.length - 1;

			// Update last row if price is empty
			if (lastIndex >= 0) {
				const lastCoin = updatedCoins[lastIndex];

				if (lastCoin.ticker && !lastCoin.price) {
					try {
						// 1. Get Binance price
						const binanceSymbol = `${lastCoin.ticker.toUpperCase()}USDT`;
						const binanceResponse = await fetch(
							`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`
						);
						const binanceData = await binanceResponse.json();
						const price = parseFloat(binanceData.price);

						// 2. Get CoinGecko market cap
						const coinGeckoId = await getCoinGeckoId(lastCoin.ticker);
						if (!coinGeckoId) throw new Error('Coin not found on CoinGecko');

						const cgResponse = await fetch(
							`https://api.coingecko.com/api/v3/coins/${coinGeckoId}?localization=false`
						);
						const cgData = await cgResponse.json();
						const mcap = cgData.market_data?.market_cap?.usd;

						// Update the row
						updatedCoins[lastIndex] = {
							...lastCoin,
							price: price.toString(),
							mcap: mcap?.toString() || '0' // Fallback to 0 if mcap missing
						};
						setCoins(updatedCoins);
					} catch (error) {
						console.error('Fetch error:', error);
						// Continue calculation with existing data
					}
				}
			}

			// Rest of your calculate function remains the same...
			const validCoins = updatedCoins
				.filter(coin => coin.ticker)
				.map(coin => ({
					ticker: coin.ticker,
					mcap: parseFloat(coin.mcap) || 0,
					price: parseFloat(coin.price) || 0
				}));

			if (validCoins.length === 0) throw new Error('Please enter at least one valid coin ticker');


			// After getting response from backend
			const response = await fetch('http://localhost:8000/calculate', {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({
					asset_cap: parseFloat(assetCap),
					total_capital: parseFloat(totalCapital),
					coins: validCoins
				})
			});

			if (!response.ok) throw new Error('Calculation failed');

			const resultData = await response.json();

			// Ensure results have the expected structure
			const formattedResults = Array.isArray(resultData)
				? resultData.map(coin => ({
					ticker: coin.ticker || '',
					amount: parseFloat(coin.amount) || 0,
					zar_value: parseFloat(coin.zar_value) || 0,
					percentage: parseFloat(coin.percentage) || 0
				}))
				: [];

			setResults(formattedResults);
			setError('');
		} catch (err) {
			setError(err.message);
			setResults(null);
		}
	};

	return (
		<div className="App">
			<h1>Crypto Index Fund Calculator</h1>

			<div className="input-section">
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
						<button onClick={() => removeCoin(index)} disabled={coins.length <= 1}>
							Remove
						</button>
					</div>
				))}
				<button onClick={addCoin}>Add Coin</button>
				<button onClick={calculate} style={{marginLeft: "10px"}}>Calculate</button>
			</div>

			{error && <div className="error">{error}</div>}

			{results && (
				<div className="results">
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