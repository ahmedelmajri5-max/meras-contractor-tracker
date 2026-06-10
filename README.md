# MERAAS Contractor Tracker

Read-only contractor tracking portal connected to Odoo for MERAAS company only.

## Safety

This app is read-only against Odoo. It blocks any method except:

- `authenticate`
- `search_read`
- `search_count`
- `read_group`
- `fields_get`

All work order queries are scoped to:

```txt
company_id = 5
```

Contractors log in by email and only see their own work orders. Generated contractor emails use this format:

```txt
contractor-<odoo_partner_id>@meras.local
```

Example:

```txt
contractor-5895@meras.local
```

## Run Locally

Create `odoo-readonly.local.ps1` from `odoo-readonly.sample.ps1`, then run:

```powershell
.\start.ps1
```

Open:

```txt
http://localhost:4185
```

## Deploy

The repo includes `render.yaml`. In Render, set these secret environment variables:

```txt
ODOO_LOGIN
ODOO_API_KEY
```

Do not upload local secrets or generated cache files.

## Main Odoo Model

The tracker reads work orders from:

```txt
project.task
```

Important fields:

- `work_order_number`
- `task_type_work_order`
- `contractor_id`
- `project_id`
- `project_location`
- `cost_center_number`
- `analytic_account_id`
- `bill_number`
- `contractor_bill`
- `total_points`
- `total_payment`
- `total_payment_request`
- `date`
- `approved_date`
- `confirmed_date`
- `write_date`
