# Custom Live Chat

## Customer features

- Guest and logged-in chat
- Name, email, and RSN before guest chat
- Real-time messages
- Typing indicators
- Delivered and read state
- Attachments
- Offline messaging
- Reconnect after network interruption
- Logged-in history
- Optional email transcript

## Staff features

- New, waiting, active, assigned, escalated, resolved, and archived states
- Browser and in-app notifications
- Customer, page, and linked-order context
- Internal notes
- Canned replies
- Transfer and escalation
- Super Administrator monitoring
- Search and filters
- Rate limiting and blocking controls

## Retention

- Default admin view: last 30 days
- Archive after 30 days
- Final deletion period configurable
- Assignment and status changes audited

## Architecture

- Socket.IO real-time transport
- MySQL persistence
- Single application instance initially
- Optional Redis adapter for future multi-instance scaling
- Private attachment URLs and file validation
