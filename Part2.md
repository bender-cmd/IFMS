## 📊 Entity Relationship Diagram (ERD) for Crypto Index Fund Management System

```
+---------------+       +----------------+       +-----------------+
|    FUND       |       |  FUND_ASSET    |       |    ASSET        |
+---------------+       +----------------+       +-----------------+
| PK fund_id    |------>| PK id          |<------| PK asset_id     |
| name          |       | FK fund_id     |       | ticker          |
| description   |       | FK asset_id    |       | name            |
| base_currency |       | target_percent |       | current_price   |
| total_cap     |       | is_active      |       | last_updated    |
| created_at    |       | created_at     |       | created_at      |
| updated_at    |       | updated_at     |       +-----------------+
+---------------+       +----------------+
        |
        |       +-----------------+
        |       |  REBALANCE_LOG  |
        |       +-----------------+
        +------| PK log_id       |
                | FK fund_id     |
                | status         |
                | timestamp      |
                | notes          |
                +----------------+
                        |
                        |       +------------------+
                        |       | REBALANCE_DETAIL |
                        +------>| PK detail_id     |
                                | FK log_id        |
                                | FK asset_id     |
                                | target_amount   |
                                | current_amount  |
                                | delta           |
                                | executed_price  |
                                +------------------+
```                            

## ✅Key Tables Explanation

    FUND: Stores index fund metadata (name, description, total capital)

    ASSET: Master list of all crypto assets with current prices

    FUND_ASSET: Junction table linking funds to their constituent assets with target percentages

    REBALANCE_LOG: Tracks each rebalancing event

    REBALANCE_DETAIL: Records specific changes needed for each asset in a rebalance


## 💡 Event Flow Diagram
```
[SCHEDULER]
     |
     v
+---------------------+
| Fetch all funds     |
+---------------------+
     |
     v
[FOR EACH FUND]
     |
     v
+-------------------------------+
| Fetch coin prices             |
+-------------------------------+
     |
     v
+-------------------------------+
| Compute current allocation    |
| Compare with target weights   |
+-------------------------------+
     |
     v
[If deviation > threshold]
     |
     v
+-------------------------------+
| Run allocation algorithm      |
+-------------------------------+
     |
     v
+-------------------------------+
| Save FundSnapshot             |
| Log to RebalanceLog           |
| (Optionally trigger trades)   |
+-------------------------------+
```

## 🚀 Detailed Event Flow:

1. **Scheduler Trigger**

        Cron job triggers based on schedule (e.g., daily at market close)
    
        Identifies funds due for rebalancing (could be all or based on custom schedules)

2. **Fetch Fund Data**

       Retrieve all active funds and their target allocations from FUND and FUND_ASSET tables

3. **Price Data Collection**

       Fetch current market prices for all constituent assets from price feed API

       Verify prices are fresh (within last X minutes)

4. **Rebalance Calculation**


       For each fund:

          a. Calculate current allocations based on latest prices
          b. Compare against target allocations
          c. Determine if rebalance threshold is met (e.g., any asset >±5% from target)
          d. Calculate required trades to return to target allocations

5. **Pre-Execution Logging**

       Store proposed rebalance actions in REBALANCE_LOG and REBALANCE_DETAIL

       Mark status as "calculated"

6. **Trade Execution**

       For funds needing rebalance:
          a. Execute trades through exchange API
          b. Implement safeguards (price slippage limits, minimum trade sizes)
          c. Handle partial fills gracefully

7. **Post-Execution Updates**

       Record actual executed prices and quantities
   
       Update fund's base currency balance
   
       Mark rebalance as "completed" or "failed" with reason

8. **Reporting**

       Generate rebalance confirmation for fund managers

       Update dashboards with new allocations

       Record performance metrics

9. **Cleanup**

       Archive old rebalance records per retention policy
    
       Trigger alerts for any failures requiring manual intervention

## 🌟 Key Considerations:

- Threshold Checking: Only rebalance when allocations drift beyond configured thresholds

- Batch Processing: Handle multiple funds efficiently in parallel

- Idempotency: Ensure scheduler can recover from mid-process failures

- Dry Run Mode: Support simulation without actual trading

- Circuit Breakers: Suspend trading during extreme market volatility