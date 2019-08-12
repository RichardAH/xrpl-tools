#   This python script connects to a Rippled instance of your choice as a peer
#   and collects and translates binary peer packets according to the protobuf
#   specification. It also responds to mtPING messages with a pong to keep
#   the connection alive.
#
#   Version 1.0
#   Author: Richard Holland
#   Date: 12 August 2019

#change this to localhost if you want to connect to your own node
server = "s.altnet.rippletest.net"
port = 51235 

from ecdsa import SigningKey, SECP256k1
from base58r import base58r
from socket import *
import ripple_pb2
import operator
import tlslite
import hashlib
import base64
import ecdsa
import re

def SHA512(b):
    h = hashlib.sha512()
    h.update(b)
    return h.digest()

#double sha256 and then return first four bytes, used for rippled node pub key
def SHA256CHK(b):
    h = hashlib.sha256()
    h.update(b)
    b = h.digest()
    h = hashlib.sha256()
    h.update(b)
    return h.digest()[0:4]

#sha512 half (first half)
def SHA512H(b):
   return SHA512(b)[0:32] 

#applies a byte by byte xor between two byte arrays
def XOR(b1, b2):
    return bytes(map(operator.xor, b1, b2))

#convert from numerical message type to string
def MT_TO_STR(mtype):
    x = mtype
    if isinstance(x, str): return x
    if x == 1: return "mtHELLO"
    if x == 2: return "mtMANIFESTS"
    if x == 3: return "mtPING"
    if x == 4: return "mtPROOFOFWORK"
    if x == 5: return "mtCLUSTER"
    if x == 12: return "mtGET_PEERS"
    if x == 13: return "mtPEERS"
    if x == 15: return "mtENDPOINTS"
    if x == 30: return "mtTRANSACTION"
    if x == 31: return "mtGET_LEDGER"
    if x == 32: return "mtLEDGER_DATA"
    if x == 33: return "mtPROPOSE_LEDGER"
    if x == 34: return "mtSTATUS_CHANGE"
    if x == 35: return "mtHAVE_SET"
    if x == 41: return "mtVALIDATION"
    if x == 42: return "mtGET_OBJECTS"
    if x == 50: return "mtGET_SHARD_INFO"
    if x == 51: return "mtSHARD_INFO"
    if x == 52: return "mtGET_PEER_SHARD_INFO"
    if x == 53: return "mtPEER_SHARD_INFO"
    return "mtUNKNOWN!!!"

#convert from string based message type identifier to numerical 
#this is designed to be human friendly, you can specify the messages
#in any case and without the prefix or underscores
def MT_TO_NUM(x):
    if isinstance(x, int): return x
    x = x.lower()
    x = re.sub('^mt', '', x)
    x = re.sub('_', '', x)
    if x == "hello": return 1
    if x == "manifests": return 2
    if x == "ping": return 3
    if x == "proofofwork": return 4
    if x == "cluster": return 5
    if x == "getpeers": return 12
    if x == "peers": return 13
    if x == "endpoints": return 15
    if x == "transaction": return 30
    if x == "getledger": return 31
    if x == "ledgerdata": return 32
    if x == "proposeledger": return 33
    if x == "statuschange": return 34
    if x == "haveset": return 35
    if x == "validation": return 41
    if x == "getobjects": return 42
    if x == "getshardinfo": return 50
    if x == "shardinfo": return 51
    if x == "getpeershardinfo": return 52
    if x == "peershardinfo": return 53
    return -1

#parse an incoming message from the connection excluding the 6 byte header
#which must have been already stripped and fed in as mtype
def PARSE_MESSAGE(mtype, msg):
    x = MT_TO_NUM(mtype)
    if x == 1:
        ret = ripple_pb2.TMHello()
        ret.ParseFromString(msg)
        return ret
    if x == 2:
        ret = ripple_pb2.TMManifests()
        ret.ParseFromString(msg)
        return ret
    if x == 3:
        ret = ripple_pb2.TMPing()
        ret.ParseFromString(msg)
        return ret
    if x == 4:
        ret = ripple_pb2.TMProofWork()
        ret.ParseFromString(msg)
        return ret
    if x == 5:
        ret = ripple_pb2.TMCluster()
        ret.ParseFromString(msg)
        return ret
    if x == 12:
        ret = ripple_pb2.TMGetPeers()
        ret.ParseFromString(msg)
        return ret
    if x == 13:
        ret = ripple_pb2.TMPeers()
        ret.ParseFromString(msg)
        return ret
    if x == 15:
        ret = ripple_pb2.TMEndpoints()
        ret.ParseFromString(msg)
        return ret
    if x == 30:
        ret = ripple_pb2.TMTransaction()
        ret.ParseFromString(msg)
        return ret
    if x == 31:
        ret = ripple_pb2.TMGetLedger()
        ret.ParseFromString(msg)
        return ret
    if x == 32:
        ret = ripple_pb2.TMLedgerData()
        ret.ParseFromString(msg)
        return ret
    if x == 33:
        ret = ripple_pb2.TMProposeSet()
        ret.ParseFromString(msg)
        return ret
    if x == 34:
        ret = ripple_pb2.TMStatusChange()
        ret.ParseFromString(msg)
        return ret
    if x == 35:
        ret = ripple_pb2.TMHaveTransactionSet()
        ret.ParseFromString(msg)
        return ret
    if x == 41:
        ret = ripple_pb2.TMValidation()
        ret.ParseFromString(msg)
        return ret
    if x == 42:
        ret = ripple_pb2.TMGetObjectByHash()
        ret.ParseFromString(msg)
        return ret
    if x == 50:
        ret = ripple_pb2.TMGetShardInfo()
        ret.ParseFromString(msg)
        return ret
    if x == 51:
        ret = ripple_pb2.TMShardInfo()
        ret.ParseFromString(msg)
        return ret
    if x == 52:
        ret = ripple_pb2.TMGetPeerShardInfo()
        ret.ParseFromString(msg)
        return ret
    if x == 53:
        ret = ripple_pb2.TMPeerShardInfo()
        ret.ParseFromString(msg)
        return ret
    return 0

#encode a message object for sending out over the connection
#including the 6 byte message type and size header
def ENCODE_MESSAGE(message_type, message):
    message_type = MT_TO_NUM(message_type)
    if message_type < 0:
        print("unknown message type: " + message_type)
        return 0
    payload = message.SerializeToString()
    length = len(payload)
    buf = length.to_bytes(4, byteorder='big') + message_type.to_bytes(2, byteorder='big') + payload
    return buf 


#generate a node key
sk = SigningKey.generate(curve=SECP256k1)
vk = sk.get_verifying_key()

#node key must be in compressed form (x-coord only) and start with magic type 0x1C
order = ecdsa.SECP256k1.generator.order()
point = vk.pubkey.point
x = (b'\x1c\x02', b'\x1c\x03')[point.y() & 1] + ecdsa.util.number_to_string(point.x(), order)
y = SHA256CHK(x) #checksum bytes
x += y

#encode node key into standard base58 notation using the ripple alphabet
b58pk = base58r.b58encode(x).decode('utf-8')

#open the socket
sock = socket(AF_INET, SOCK_STREAM)
sock.connect( (server, port) )

#attach the tls class  /  this tls lib has been modified to expose the finished messages for use in the rippled cookie
connection = tlslite.TLSConnection(sock)
connection.handshakeClientCert()

#extract and calculate message hashes
cookie1 = SHA512(connection.remoteLastMessage())
cookie2 = SHA512(connection.localLastMessage())
cookie = SHA512H(XOR(cookie1, cookie2))

#the cookie must be signed with our private key
sig = base64.b64encode(sk.sign_digest(cookie, sigencode=ecdsa.util.sigencode_der)).decode('utf-8')

#finally construct the GET request which will allow us to say hello to the rippled server
request =  'GET / HTTP/1.1\r\n'
request += 'User-Agent: rippled-1.3.1\r\n'
request += 'Upgrade: RTXP/1.2\r\n'
request += 'Connection: Upgrade\r\n'
request += 'Connect-As: Peer\r\n'
request += 'Crawl: private\r\n'
request += 'Session-Signature: '+sig+'\r\n'
request += 'Public-Key: '+b58pk+'\r\n\r\n'

#send the request
connection.send(bytes(request, 'utf-8'))

#the first packet will still be http
packet = connection.recv(1024).decode('utf-8')

#we should get back the 'switching protocols' packet
if not "Switching Protocols" in packet:
    print("Failed to connected, received:")
    print(packet)
    quit()

#there's some interesting info in this header
server_version = ""
server_key = ""
server_closed_ledger = ""
server_private = ""

headers = packet.split("\r\n")
#collect the interesting info
for fh in headers:
    if ": " in fh:
        ph = fh.split(": ") 
        if ph[0] == "Server":
            server_version = ph[1]
            print("node version: " + server_version) 
        elif ph[0] == "Public-Key":
            server_key = ph[1]
            print("node key: " + server_key)
        elif ph[0] == "Closed-Ledger":
            server_closed_ledger = ph[1]
            print("last closed ledger: " + server_closed_ledger)
        elif ph[0] == "Crawl":
            server_private = ph[1] == "private" 
            print("server is " + ("private" if server_private else "public"))

#NB: execution to this point means the connection was successful

#message loop
while True:
    #collect the raw packet from the connection
    raw_packet = connection.recv(0xffff)
    
    #parse the 6 byte header which is in network byte order
    message_size = int.from_bytes(raw_packet[0:4], byteorder='big')
    message_type = int.from_bytes(raw_packet[4:6], byteorder='big')
    message_type_str = MT_TO_STR(message_type)

    #parse the message itself
    # nb depending on routing there might be another packet concatenated to this one but we're assuming there isn't
    message = PARSE_MESSAGE(message_type, raw_packet[6:message_size+6])

    #debug printing, you can remove
    print("packet received of type " + message_type_str + " and size " + str(message_size) + " bytes")
    
    #check for pings and respond with a pong
    if message_type == 3: #(mtPING)
        print(message) #debug you can remove
        message.type = message.ptPONG 
        connection.send(ENCODE_MESSAGE('mtPing', message)) 
        print("sent pong") #debug you can remove

    #TODO for code user: insert your message handling here!
