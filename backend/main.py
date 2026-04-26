import os
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db, AsyncSessionLocal
from models import Transcript
from routers import transcripts, search, feedback


SEED_TRANSCRIPTS = [
    {
        "title": "WiFi connectivity drops every few hours",
        "caller_name": "Maria Chen",
        "agent_name": "James Park",
        "call_date": datetime(2024, 11, 1, 10, 30),
        "category": "Connectivity",
        "content": """Agent: Thank you for calling TechSupport, this is James. How can I help you today?

Caller: Hi James, I'm having a really frustrating issue. My WiFi keeps dropping every few hours. I'll be in the middle of a video call and suddenly lose connection.

Agent: I'm sorry to hear that, Maria. How long has this been happening?

Caller: About two weeks now. It started after a Windows update.

Agent: That's a helpful detail. Let me walk you through some troubleshooting steps. First, can you check if your router firmware is up to date?

Caller: How do I do that?

Agent: Log into your router's admin panel — usually at 192.168.1.1 — and look for a firmware update option. While you're there, can you also check the WiFi channel your router is using?

Caller: It says channel 6.

Agent: Channel 6 is heavily congested in most areas. Let's switch to channel 11 or auto-select. Also, in Windows power settings, set WiFi adapter to maximum performance to prevent it from sleeping.

Caller: Oh, that might be it! My laptop was on battery saver mode.

Agent: Exactly. The power management feature can cause the WiFi adapter to disconnect. Go to Device Manager, find your network adapter, right-click Properties, Power Management tab, and uncheck "Allow the computer to turn off this device to save power."

Caller: Done! Should I also update the network driver?

Agent: Yes, that's a great idea. Visit your laptop manufacturer's website and download the latest WiFi driver. The Windows Update driver might not be the latest.

Caller: That all makes sense. I'll try these steps and see if it helps.

Agent: Perfect. If it still drops after 24 hours, call back and we'll look at DNS settings and TCP/IP stack reset. Is there anything else I can help you with?

Caller: No, that's great. Thank you so much!

Resolution: Updated WiFi driver, changed power management settings, switched router to channel 11.""",
    },
    {
        "title": "Outlook not syncing emails on mobile",
        "caller_name": "David Torres",
        "agent_name": "Sarah Mitchell",
        "call_date": datetime(2024, 11, 3, 14, 15),
        "category": "Email",
        "content": """Agent: TechSupport, Sarah speaking. How can I assist you?

Caller: Hi Sarah, my Outlook app on my iPhone stopped syncing emails. I can see them on my computer but not on my phone.

Agent: When did this start, David?

Caller: Yesterday afternoon. I didn't change anything.

Agent: Let's start with the basics. Can you go to Settings > Mail > Accounts on your iPhone and check if your account is still listed?

Caller: Yes it's there, but the toggle for Mail is off!

Agent: There's your issue. Toggle it back on. This sometimes happens after iOS updates. Give it about 30 seconds to start syncing.

Caller: It's showing new emails now! But wait, some emails from last week are missing.

Agent: The default sync window for Outlook mobile is 3 days. To get older emails, open Outlook settings, tap your account, and change "Mail to sync" to 1 month or more.

Caller: Found it, changing to 1 month now. It's downloading.

Agent: Also make sure Background App Refresh is enabled for Outlook under iOS Settings > General > Background App Refresh. This ensures emails arrive even when the app is closed.

Caller: Perfect, all emails are back now. Thank you!

Resolution: iOS update disabled mail sync toggle. Re-enabled sync and adjusted sync window to 1 month.""",
    },
    {
        "title": "Printer shows offline but is powered on",
        "caller_name": "Robert Kim",
        "agent_name": "James Park",
        "call_date": datetime(2024, 11, 5, 9, 0),
        "category": "Printing",
        "content": """Agent: TechSupport, James here. What's going on?

Caller: My printer says offline in Windows but it's clearly on and shows ready on its display.

Agent: Classic issue, Robert. Is it a network printer or USB connected?

Caller: Network printer, it's on WiFi.

Agent: First, let's try the quick fix. Right-click the printer in Windows Devices and Printers, select "See what's printing", then Printer menu and uncheck "Use Printer Offline" if it's checked.

Caller: It was checked! Unchecked it but still showing offline.

Agent: Okay, let's remove and re-add the printer. Go to Settings > Bluetooth and Devices > Printers and Scanners, click your printer, and select Remove.

Caller: Done.

Agent: Now restart the Print Spooler service. Press Win+R, type services.msc, find Print Spooler, right-click, Restart. Then re-add the printer.

Caller: The spooler was stopped! Restarted it. Adding the printer back now. It found it on the network.

Agent: A stopped Print Spooler is usually the culprit. While you're in there, set the spooler service to Automatic startup so it starts with Windows.

Caller: Set to Automatic. Printer test page printed perfectly!

Agent: Great. If it goes offline again, check if the printer's IP address has changed — set a static IP in the printer's network settings to prevent that.

Resolution: Print Spooler service was stopped. Restarted service, set to automatic. Printer re-added successfully.""",
    },
    {
        "title": "Computer extremely slow after malware removal",
        "caller_name": "Jennifer Walsh",
        "agent_name": "Sarah Mitchell",
        "call_date": datetime(2024, 11, 7, 16, 45),
        "category": "Performance",
        "content": """Agent: TechSupport, Sarah Mitchell. How can I help?

Caller: My computer is so slow it's barely usable. My IT person removed some malware yesterday and now it's worse than before.

Agent: That can happen, Jennifer. Malware removal tools sometimes disable startup programs aggressively or the malware removal itself leaves fragmented files. How slow are we talking?

Caller: Takes 15 minutes to boot. Then everything lags. It was fine before the malware.

Agent: Let's check startup programs. Press Ctrl+Shift+Esc for Task Manager, click Startup tab. What does the startup impact column look like?

Caller: Almost everything says "High" impact. There are like 30 programs starting up.

Agent: The malware scanner likely re-enabled everything or the malware added entries. Disable anything not essential — you can keep antivirus and drivers, but disable things like Spotify, Discord, Teams, OneDrive if you don't need them at startup.

Caller: Disabled about 20 items. Should I also run Disk Cleanup?

Agent: Yes, and also check if the C: drive is nearly full. Low disk space causes severe slowdowns.

Caller: Oh! Only 4GB free on a 256GB drive. That's the problem!

Agent: Definitely. You need at least 10-15% free. Run Disk Cleanup as administrator, include system files. Also check if any huge log files were created during the malware removal in C:\Windows\Temp.

Caller: There are 40GB of log files in Temp! Deleting now.

Agent: After cleanup, run the Disk Defragmenter if it's a traditional hard drive, or Windows Optimization if it's an SSD.

Caller: It's an SSD. After deleting those temp files, I have 44GB free now. Restarting to test the startup time.

Caller (after restart): 2 minutes to boot! Back to normal!

Resolution: Malware removal created 40GB of log files filling the SSD. Clearing temp files and disabling excessive startup programs resolved the performance issue.""",
    },
    {
        "title": "Two-factor authentication locked out",
        "caller_name": "Angela Foster",
        "agent_name": "Marcus Lee",
        "call_date": datetime(2024, 11, 10, 11, 30),
        "category": "Authentication",
        "content": """Agent: TechSupport, Marcus Lee speaking. How can I assist you?

Caller: I'm completely locked out of my work account. I got a new phone and can't receive the authentication codes anymore.

Agent: That's a stressful situation, Angela. Let me verify your identity first before we proceed. Can you provide your employee ID and answer your security question?

Caller: Employee ID is AF-4892. Security question: my first pet was "Biscuit."

Agent: Verified. So your authenticator app was on your old phone?

Caller: Yes, Google Authenticator. I didn't realize I couldn't transfer it.

Agent: This is a common issue. You have a few options. First, do you still have access to your old phone, even without a SIM?

Caller: Yes, it's at home.

Agent: If you can get WiFi access on the old phone, we can temporarily use that to generate a code and add a backup method. Alternatively, do you have any backup codes that were generated when you set up 2FA?

Caller: I printed them! One second... yes, I have them.

Agent: Perfect, that's exactly what backup codes are for. Use one of those to log in — each one works once. Once you're in, immediately go to security settings and add your new phone's authenticator app.

Caller: Using backup code now... I'm in! Adding my new phone to Google Authenticator.

Agent: Great. This time, when you set it up, take a screenshot of the QR code or write down the secret key. Store it somewhere secure. Also consider adding a backup authentication method like a trusted phone number for SMS as a fallback.

Caller: Good advice. All set up on new phone. Thank you so much!

Resolution: User locked out after phone replacement. Backup codes used for access. New phone added to authenticator with advice on backup storage.""",
    },
    {
        "title": "VPN disconnecting during large file transfers",
        "caller_name": "Tom Bradley",
        "agent_name": "Marcus Lee",
        "call_date": datetime(2024, 11, 12, 15, 0),
        "category": "Connectivity",
        "content": """Agent: TechSupport, Marcus here. What can I do for you?

Caller: Every time I try to transfer large files through VPN, it disconnects after about 10 minutes. Small files work fine.

Agent: Hi Tom, is this a corporate VPN or personal?

Caller: Corporate. Cisco AnyConnect.

Agent: This is a known issue with some corporate VPN configurations. The connection likely has a timeout or the MTU (Maximum Transmission Unit) is causing fragmentation on large packets. What's your home internet connection?

Caller: Cable, about 500Mbps.

Agent: Let's check the MTU first. Open Command Prompt and run: ping -f -l 1400 vpn.company.com

Caller: It says "Packet needs to be fragmented but DF set."

Agent: Increase the MTU test value to 1472. If that works, your MTU is fine and we look elsewhere. If still fragmented, lower to 1300.

Caller: 1300 works, 1400 doesn't.

Agent: So the VPN tunnel needs an MTU of around 1300. I'll need to coordinate with the network team to adjust the VPN server configuration. However, in the meantime, you can work around this by compressing files before transfer — zip them in batches under 100MB.

Caller: That would work for now. Also, should I report the VPN timeout to anyone?

Agent: Yes, I'll open a ticket with the network team for the MTU setting. The disconnect might also be a DPD (Dead Peer Detection) timeout — if the large transfer uses all bandwidth and there's no heartbeat traffic, the tunnel drops. I'll include that in the ticket.

Caller: Thank you, I'll use the zip workaround until it's fixed.

Resolution: VPN MTU mismatch causing large packet fragmentation and tunnel drops. Ticket opened with network team. Workaround: compress files to <100MB batches.""",
    },
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    # Seed sample transcripts on first run
    async with AsyncSessionLocal() as db:
        from sqlalchemy import select, func
        count_result = await db.execute(select(func.count()).select_from(Transcript))
        count = count_result.scalar()
        if count == 0:
            for data in SEED_TRANSCRIPTS:
                db.add(Transcript(**data))
            await db.commit()
    yield


app = FastAPI(
    title="TechSupport Transcript Search",
    description="AI-powered search over technical support call transcripts",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transcripts.router)
app.include_router(search.router)
app.include_router(feedback.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
