import React, {useState} from 'react';
import './App.css';

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
			const validCoins = coins.map(coin => ({
				ticker: coin.ticker,
				mcap: parseFloat(coin.mcap),
				price: parseFloat(coin.price)
			})).filter(coin => !isNaN(coin.mcap) && !isNaN(coin.price) && coin.ticker);

			if (validCoins.length === 0) throw new Error('Please enter valid coins');

			const response = await fetch('http://localhost:8000/calculate', {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({
					asset_cap: parseFloat(assetCap),
					total_capital: parseFloat(totalCapital),
					coins: validCoins
				}),
			});

			if (!response.ok) throw new Error('Calculation failed');
			setResults(await response.json());
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