"""Create Mnemo subscription plans in Square sandbox."""

import os
import uuid
from dotenv import load_dotenv
from square import Square
from square.environment import SquareEnvironment

load_dotenv()

client = Square(
    token=os.getenv("SQUARE_ACCESS_TOKEN"),
    environment=SquareEnvironment.SANDBOX,
)
location_id = os.getenv("SQUARE_LOCATION_ID")

# Step 1: Create the catalog items (subscription plans)
result = client.catalog.batch_upsert(
    idempotency_key=str(uuid.uuid4()),
    batches=[
        {
            "objects": [
                {
                    "type": "SUBSCRIPTION_PLAN",
                    "id": "#mnemo-solo",
                    "subscription_plan_data": {
                        "name": "Mnemo Cloud Solo",
                        "phases": [
                            {
                                "cadence": "MONTHLY",
                                "recurring_price_money": {
                                    "amount": 2900,
                                    "currency": "USD",
                                },
                            }
                        ],
                    },
                },
                {
                    "type": "SUBSCRIPTION_PLAN",
                    "id": "#mnemo-teams",
                    "subscription_plan_data": {
                        "name": "Mnemo Cloud Teams",
                        "phases": [
                            {
                                "cadence": "MONTHLY",
                                "recurring_price_money": {
                                    "amount": 9900,
                                    "currency": "USD",
                                },
                            }
                        ],
                    },
                },
            ]
        }
    ],
)

if result.id_mappings:
    print("Subscription plans created successfully!\n")
    for mapping in result.id_mappings:
        print(f"  {mapping.client_object_id} -> {mapping.object_id}")

    solo_id = None
    teams_id = None
    for mapping in result.id_mappings:
        if mapping.client_object_id == "#mnemo-solo":
            solo_id = mapping.object_id
        elif mapping.client_object_id == "#mnemo-teams":
            teams_id = mapping.object_id

    print(f"\nAdd these to your .env:")
    print(f"SQUARE_SOLO_PLAN_ID={solo_id}")
    print(f"SQUARE_TEAMS_PLAN_ID={teams_id}")
else:
    print("Error or already exists. Response:")
    print(result)
