from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List
import httpx

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


class CoinInput(BaseModel):
    ticker: str
    mcap: float = Field(..., gt=0, description="Market capitalization must be positive.")
    price: float = Field(..., gt=0, description="Price must be positive.")


class FundParams(BaseModel):
    asset_cap: float = Field(..., gt=0, le=1, description="Asset cap must be between 0 and 1.")
    total_capital: float = Field(..., gt=0, description="Total investment capital must be positive.")
    coins: List[CoinInput]


class CoinOutput(BaseModel):
    ticker: str
    amount: float
    zar_value: float
    percentage: float


def calculate_allocation(asset_cap: float, total_capital: float, coins: List[CoinInput]) -> List[CoinOutput]:
    total_mcap = sum(coin.mcap for coin in coins)
    weights = [coin.mcap / total_mcap for coin in coins]

    while True:
        capped_weights = [min(w, asset_cap) for w in weights]
        remainder = 1 - sum(capped_weights)

        uncapped_indices = [
            i for i, w in enumerate(weights)
            if weights[i] > asset_cap
        ]

        if not uncapped_indices or remainder <= 0:
            weights = capped_weights
            break

        uncapped_total = sum(weights[i] for i in uncapped_indices)
        for i in uncapped_indices:
            weights[i] = capped_weights[i] + remainder * (weights[i] / uncapped_total)

    # Normalize to fix rounding issues
    total_weight = sum(weights)
    weights = [w / total_weight for w in weights]

    results = []
    for coin, weight in zip(coins, weights):
        zar_value = total_capital * weight
        amount = zar_value / coin.price
        results.append(CoinOutput(
            ticker=coin.ticker,
            amount=amount,
            zar_value=zar_value,
            percentage=weight * 100
        ))

    return results


@app.post("/calculate", response_model=List[CoinOutput], summary="Calculate fund allocation")
async def calculate_fund(params: FundParams):
    if not params.coins:
        raise HTTPException(status_code=400, detail="At least one coin must be provided.")

    # Enforce minimum equal-weight cap if necessary
    min_cap = 1 / len(params.coins)
    effective_cap = max(params.asset_cap, min_cap)

    return calculate_allocation(effective_cap, params.total_capital, params.coins)


@app.get("/binance_price")
async def get_binance_price(symbol: str):
    url = f"https://api.binance.com/api/v3/ticker/price?symbol={symbol}"
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
    return response.json()

@app.get("/coingecko_data")
async def get_binance_price(coin_gecko_id: str):
    url = f"https://api.coingecko.com/api/v3/coins/${coin_gecko_id}?localization=false"
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
    return response.json()