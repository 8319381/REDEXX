```mermaid
erDiagram
    COMPANIES ||--o{ USERS : employs
    USERS ||--o{ REQUESTS : creates
    USERS ||--o{ OFFERS : publishes
    USERS ||--o{ NOTIFICATIONS : receives
    REQUESTS ||--o{ REQUEST_OFFERS : receives
    OFFERS ||--o{ REQUEST_OFFERS : matches
    OFFERS ||--o{ PLANNED_OFFER_DEPARTURES : has
    REQUEST_OFFERS ||--o{ REQUEST_OFFER_DEPARTURES : has
    REQUEST_OFFERS ||--o{ PAYMENTS : paid_by
    NOTIFICATION_TEMPLATES ||--o{ NOTIFICATIONS : materializes
    
    COMPANIES {
        int id PK
        string name
        string type
    }
    
    USERS {
        int id PK
        int company_id FK
        string email
        string full_name
        string phone
        string role
        datetime created_at
        datetime updated_at
        boolean is_blocked
    }
    
    REQUESTS {
        int id PK
        int created_by FK
        string origin_point
        string destination_point
        string container_type
        numeric volume_m3
        numeric weight_kg
        string transport_type
        string incoterms
        date cargo_ready_date
        string status
        datetime created_at
        datetime updated_at
        string additional_comments
    }
    
    OFFERS {
        int id PK
        int provider_user_id FK
        string origin_point
        string destination_point
        string container_type
        numeric volume_m3
        numeric weight_kg
        string transport_type
        string incoterms
        int delivery_time_days
        numeric price_amount
        date validity_date
        boolean is_hot
        string border_crossing_point
        string customs_clearance_location
        string comment
        datetime created_at
        datetime updated_at
    }
    
    REQUEST_OFFERS {
        int id PK
        int request_id FK
        int offer_id FK
        string status
        datetime created_at
        datetime updated_at
    }
    
    PLANNED_OFFER_DEPARTURES {
        int id PK
        int offer_id FK
        date departure_date
    }
    
    REQUEST_OFFER_DEPARTURES {
        int id PK
        int request_offer_id FK
        date departure_date
    }
    
    PAYMENTS {
        int id PK
        int request_offer_id FK
        numeric amount
        string status
        datetime payment_date
    }
    
    NOTIFICATION_TEMPLATES {
        int id PK
        string code
        string title_template
        string body_template
    }
    
    NOTIFICATIONS {
        int id PK
        int user_id FK
        int template_id FK
        jsonb payload
        string channel
        string delivery_status
        boolean is_read
        datetime created_at
    }
    ```