# Merkle Lunch App Chrome Extension

## Introduction
This extension was developed to solve a common problem in our office:
managing lunch orders when colleagues are out of office (OOO).
This extension allows people to:

- Mark colleagues as out of office
- See what lunch orders are available from OOO colleagues
- Claim available lunches
- Keep track of who has taken which lunch

Please use the extension responsibly, it relies on good faith rather than authentication.

## Installation
You'll need to install it in Chrome's developer mode. Here's how:

1. Clone this repository or download the `extension` folder.
2. Load the extension in Chrome:
    - Open Chrome or Arc and navigate to `chrome://extensions/` or `arc://extensions/`
    - Enable "Developer mode" in the top right corner
    - Click "Load unpacked" in the top left
    - Select the `extension` folder from your project directory

The extension icon should now appear in your Chrome toolbar.

## Usage

#### Initial Setup
1. Click the extension icon in your Chrome toolbar
2. Enter your full name when prompted
    - This is used to track who claims which lunches
    - You can change your name later by clicking your name in the top right
    - It is saved as a cookie (30-days expiration)

#### Marking Someone as OOO
1. Use the search field to find the person's name
2. Click "Mark as OOO" to add them to the list
    - Their pre-ordered lunch will automatically appear in the table

#### Claiming a Lunch
1. Find the available lunch in the table
2. Click "Take lunch" next to the order you want
3. Confirm your choice
    - Once claimed, other users will see that you've taken this lunch
4. This CANNOT be undone

#### Removing Someone from OOO List
1. Find the person in the table
2. Click the ❌ icon to remove them
    - Only do this if they're actually back in office
    - If someone already claimed their lunch, tell them the person is not OOO

## Development

#### Database
In order to run the database yourself, create a supabase project and upload the edge function inside the `supabase` folder.

#### TO-DO
1. Email auth (anyone can send an email to Cloudmailin to update the running database)
2. User auth (anyone can use any name when claiming lunches)
3. Swapping lunches (would be cool to put your own lunch up for grabs)