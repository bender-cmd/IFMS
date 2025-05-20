from fastapi import FastAPI, HTTPException, Depends
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


async def fetch_data(
    client: httpx.AsyncClient,
    url: str,
    error_prefix: str = "API"
) -> dict:
    """
    Function to fetch data from an external API with error handling.

    Args:
        client: httpx.AsyncClient (dependency-injected).
        url: Target API URL.
        error_prefix: Custom prefix for error messages (e.g., "Binance").

    Returns:
        JSON response as a dictionary.

    Raises:
        HTTPException: If the request fails.
    """
    try:
        response = await client.get(url)
        response.raise_for_status()  # Raises HTTPStatusError for 4XX/5XX
        return response.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=f"{error_prefix} API error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error: {str(e)}"
        )


async def get_httpx_client():
    async with httpx.AsyncClient() as client:
        yield client


@app.get("/binance_price",
          description="Fetches coin prices from Binance API.",
          tags=["Binance Price"])
async def get_binance_price(symbol: str, client: httpx.AsyncClient = Depends(get_httpx_client)):
    if not symbol.isalpha():
        raise HTTPException(status_code=400, detail="Invalid symbol format.")

    url = f"https://api.binance.com/api/v3/ticker/price?symbol={symbol}"
    return await fetch_data(client, url, error_prefix="Binance")


@app.get("/coingecko_data",
          description="Fetches coingecko data. Needed for MCAP.",
          tags=["Coingecko Data"])
async def get_coingecko_data(coin_gecko_id: str, client: httpx.AsyncClient = Depends(get_httpx_client)):
    url = f"https://api.coingecko.com/api/v3/coins/{coin_gecko_id}?localization=false"
    return await fetch_data(client, url, error_prefix="CoinGecko Data")


@app.get("/coingecko_coin_list",
          description="Fetches coingecko coin list which is stored locally for some time.",
          tags=["Coingecko Coin List"])
async def get_coingecko_coin_list(client: httpx.AsyncClient = Depends(get_httpx_client)):
    url = "https://api.coingecko.com/api/v3/coins/list"
    return await fetch_data(client, url, error_prefix="CoinGecko Coin List")

def calculate_allocation(asset_cap: float, total_capital: float, coins: List[CoinInput]) -> List[CoinOutput]:
    total_mcap = sum(coin.mcap for coin in coins)
    weights = [coin.mcap / total_mcap for coin in coins]

    while True:
        capped_weights = [min(w, asset_cap) for w in weights]
        remainder = 1 - sum(capped_weights)

        uncapped_indices = [
            i for i, w in enumerate(weights)
            if weights[i] >= capped_weights[i]
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


@app.post("/calculate", response_model=List[CoinOutput],
          summary="Calculate fund allocation",
          description="Performs weighted allocation of capital across crypto assets.",
          tags=["Fund Allocation"])
async def calculate_fund(params: FundParams):
    if not params.coins:
        raise HTTPException(status_code=400, detail="At least one coin must be provided.")

    # Enforce minimum equal-weight cap if necessary
    min_cap = 1 / len(params.coins)
    effective_cap = max(params.asset_cap, min_cap)

    return calculate_allocation(effective_cap, params.total_capital, params.coins)
