# Ovelo Maintenance

Ovelo Maintenance is an AI-powered maintenance operations dashboard built for letting agencies.

The application is designed to help agency teams monitor and manage maintenance cases handled by an AI assistant, without trying to replace their existing CRM or property management software.

## What it does

The dashboard connects to Supabase and displays maintenance cases stored in the `maintenance_cases` table.

Cases are organised into three sections:

- Needs Attention
- In Progress
- Completed

Each case displays:

- Tenant name
- Property address
- Issue category
- Urgency
- Status

Selecting a case opens a detailed view containing:

- AI-generated case summary
- Issue description
- Case information
- Current status

## Product focus

Ovelo is designed as an AI operations console for maintenance workflows.

It is intentionally not a CRM, property management system, or tenant database.

The goal is to give letting agencies a simple interface for reviewing and managing maintenance cases processed by AI.

## Tech stack

- React
- TypeScript
- Supabase
- PostgreSQL
- Lovable

## Live app

https://app.ovelo.tech

## Development

This project was initially built using Lovable and is synced with GitHub.

To run the project locally:

```sh
git clone <this-repository-url>
cd <repository-name>
npm install
npm run dev
