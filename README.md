# AI Maintenance Enquiry & Case Management

A prototype that connects phone and WhatsApp enquiries to a shared maintenance dashboard, helping letting agencies capture issues and keep people informed without manually transferring information between tools.

## The problem I investigated

I spoke with independent letting agencies about their day-to-day operations. Those conversations highlighted administrative work around maintenance enquiries: gathering details, recording issues, coordinating responses and keeping people updated.

I built this project to explore how those steps could connect into one workflow, with agency staff able to review and manage the resulting cases.

## What I built

The system turns an incoming enquiry into a structured maintenance case.

1. A tenant reports an issue by phone or WhatsApp.
2. An AI agent captures the enquiry and relevant details.
3. APIs and webhooks transfer the information into a case stored in Supabase.
4. Staff review the case in a dashboard, including the issue summary and supporting information.
5. Automated SMS messages notify relevant recipients when a case is created and as its status changes.

For phone enquiries, the case also contains the call recording, transcript and AI-generated summary.

## From customer problem to working workflow

My contribution covered understanding the problem, configuring the agents and connecting the services.

### Customer discovery

I spoke with letting agencies to understand their maintenance processes and where administrative work accumulated. These conversations informed the focus on enquiry capture, case visibility and updates.

### Voice and WhatsApp agents

I built a voice agent using ElevenLabs and Telnyx, alongside a Meta WhatsApp AI agent for written enquiries.

Both channels feed information into the case-management workflow, allowing staff to review enquiries in one place.

### API and webhook integrations

I connected the agents and application through APIs and webhooks so captured information could create cases in the dashboard.

For calls, the workflow brings together the recording, transcript and summary alongside the case details.

### Case-management application

I used Lovable to build a React and TypeScript dashboard backed by Supabase and PostgreSQL.

Staff can review cases across three stages:

- Needs Attention
- In Progress
- Completed

Each case includes the tenant name, property address, issue category, urgency and status. A detailed view provides the issue description and supporting information.

### Automated notifications

I configured SMS notifications to inform relevant recipients when a case is created and as it progresses through different stages.

## How the components connect

| Component | Purpose |
|---|---|
| Voice and WhatsApp agents | Capture incoming enquiries |
| ElevenLabs | Power the AI voice agent |
| Telnyx and Twilio | Support telephony and messaging integrations |
| APIs and webhooks | Transfer information between services and trigger workflow actions |
| Supabase and PostgreSQL | Store structured case information |
| React and TypeScript | Provide the agency-facing dashboard |
| Lovable | Support AI-assisted application development |

## What the prototype demonstrates

The prototype demonstrates an enquiry-to-case workflow that:

- Captures information through voice and WhatsApp.
- Creates a structured case for staff to review.
- Makes call recordings, transcripts and summaries available alongside the case.
- Sends updates when cases are created or change stage.

These are implemented capabilities, rather than measured business outcomes. I have not established a quantified reduction in agency workload or processing time.

## How I approached the project

I started with a customer workflow and worked out how to connect the services needed to support it.

I used AI-assisted development tools for the application and configured the external agents and integrations. My contribution includes customer discovery, workflow design, service configuration and connecting the components.

The application was not entirely hand-coded. This repository documents what I built, the tools I used and the scope of the prototype.

## Scope and limitations

This is a prototype, not a production-ready service.

The repository contains the application code. Reproducing the complete workflow also requires configuration of the external voice and messaging services, backend secrets, database permissions and webhook endpoints.

The project does not currently demonstrate integration with an agency’s existing CRM. Any such integration would require additional work.

Further validation would include:

- Testing incomplete or ambiguous enquiries.
- Handling failed API calls and duplicate webhook events.
- Checking access permissions for case information and recordings.
- Testing notification failures.
- Measuring the effect on staff workload through real-world use.

## What I learned

This project helped me develop practical experience in translating a customer problem into a connected technical workflow.

I worked with conversational AI, APIs, webhooks and database-backed applications, while learning how much depends on the connections between services—not just the individual tools.

It also helped me distinguish between demonstrating that a workflow works and proving that it is reliable, secure and useful in a customer’s day-to-day operations.
