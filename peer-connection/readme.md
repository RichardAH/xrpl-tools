# Peer Connection
## What is this?
Rippled nodes communicate with eachother using a binary peer to peer protocol specified in rippled.proto

Sometimes desired information about your Rippled node is not easily avaliable through an existing API, in these cases it may be advantageous to connect to your Rippled node directly as a peer and read the messages it is sending out.

## How to use it
To run:

>python3 peercon.py

This script is for advanced users, and must be modified by the programmer to be useful. In its current form it only maintains the connection, responds to pings and parses incoming messages into objects. 
