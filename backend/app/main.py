from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Enable CORS
app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_methods=["*"],
	allow_headers=["*"],
    allow_credentials=True,
)


class CoinInput(BaseModel):
	ticker: str
	mcap: float
	price: float


class FundParams(BaseModel):
	asset_cap: float
	total_capital: float
	coins: List[CoinInput]


class CoinOutput(BaseModel):
	ticker: str
	amount: float
	zar_value: float
	percentage: float


def calculate_allocations(asset_cap: float, total_capital: float, coins: List[CoinInput]) -> List[CoinOutput]:
	# Calculate total market cap
	total_mcap = sum(coin.mcap for coin in coins)

	# Calculate initial uncapped weights
	initial_weights = [coin.mcap / total_mcap for coin in coins]

	# Apply asset cap
	capped = False
	while True:
		# Calculate current weights after capping
		current_weights = [min(w, asset_cap) for w in initial_weights]
		remaining = 1 - sum(current_weights)

		# Find assets that haven't hit the cap
		uncapped_indices = [i for i, w in enumerate(initial_weights)
							if current_weights[i] >= initial_weights[i] and initial_weights[i] > 0]

		if not uncapped_indices or remaining <= 0:
			break

		# Distribute remaining weight proportionally
		total_uncapped = sum(initial_weights[i] for i in uncapped_indices)
		for i in uncapped_indices:
			additional = remaining * (initial_weights[i] / total_uncapped)
			current_weights[i] += additional

		initial_weights = current_weights # reset initial weights

	# Normalize to ensure sum is exactly 1 (handles floating point precision)
	sum_weights = sum(current_weights)
	current_weights = [w / sum_weights for w in current_weights]

	# Calculate amounts and values
	results = []
	for coin, weight in zip(coins, current_weights):
		zar_value = total_capital * weight
		amount = zar_value / coin.price
		results.append(CoinOutput(
			ticker=coin.ticker,
			amount=amount,
			zar_value=zar_value,
			percentage=weight * 100
		))

	return results


@app.post("/calculate", response_model=List[CoinOutput])
async def calculate_fund(params: FundParams):

	# params = FundParams(asset_cap=0.1, total_capital=1000.0, coins=[CoinInput(ticker='BTC', mcap=20000.0, price=50.0), CoinInput(ticker='ETH', mcap=10000.0, price=25.0), CoinInput(ticker='LTC', mcap=5000.0, price=10.0)])

	if params.asset_cap <= 0 or params.asset_cap > 1:
		raise ValueError("Asset cap must be between 0 and 1")

	if params.total_capital <= 0:
		raise ValueError("Total capital must be positive")

	if len(params.coins) == 0:
		raise ValueError("At least one coin must be provided")

	# Check if asset cap is below theoretical minimum
	min_cap = 1 / len(params.coins)
	if params.asset_cap < min_cap:
		# In this case, we set all assets to the cap (which will be equal)
		params.asset_cap = min_cap

	return calculate_allocations(params.asset_cap, params.total_capital, params.coins)

@app.get("/api")
async def root():
	return {"message": "Hello from FastAPI!"}