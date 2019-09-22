/**

    This is a script for using XRPL validator keys to produce an XRPL address and corresponding private key
    The keys are the same, just reformated to work as an account keypair
    Included is a function to rekey your validator's XRPL account, for ease of use and security
    
    Version 1.1
    Author: Richard Holland
    Date: 22 Sep 2019

**/

'use strict';
//NB: All functions assume ED25519 keys
const RippleAPI = require('ripple-lib')
const ed = require('elliptic').eddsa
const ec = new ed('ed25519');
const address_codec = require('ripple-address-codec');
const assert = require('assert');
const crypto = require('crypto');
const R_B58_DICT = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';
const base58 = require('base-x')(R_B58_DICT);
assert(crypto.getHashes().includes('sha256'));
assert(crypto.getHashes().includes('ripemd160'));

function xaddr(raddr, tag) {
	var flag = tag === false ? 0 : tag < 4294967296  ? 1 : 2
	if (flag == 2) return false
	var decoded = address_codec.decodeAccountID(raddr)
	if (!decoded) return false
	return address_codec.codecs.ripple.encodeChecked([0x05, 0x44].concat(decoded.concat(
		[flag, tag & 0xff, (tag  >> 8) & 0xff, (tag >> 16) & 0xff, (tag >> 24) & 0xff, 0,0,0,0])))
}

function raddr(xaddr) {
	var decoded = address_codec.codecs.ripple.decodeChecked(xaddr)
	if (!decoded) return false
	var raddr = address_codec.encodeAccountID(decoded.slice(2,22))
	var tag = decoded[22] == 0 ? false : decoded[23] + decoded[24] * 0x100 + decoded[25] * 0x10000 + decoded[26] * 0x1000000
	return decoded[22] > 1 ? false : {raddr: raddr, tag: tag}
}

function public_key_from_validator_pk(pk) {
    var pubkey = pk
    pubkey = address_codec.decode(pk)
    pubkey = pubkey.slice(1, 34)
    return pubkey
}

function xrpl_address_from_validator_pk(pk, skipdecode) {
    var pubkey = pk
    if (!skipdecode) 
        pubkey = public_key_from_validator_pk(pk)
    assert(pubkey.length == 33);
    const pubkey_inner_hash = crypto.createHash('sha256').update(Buffer.from(pubkey));
    const pubkey_outer_hash = crypto.createHash('ripemd160');
    pubkey_outer_hash.update(pubkey_inner_hash.digest());
    const account_id = pubkey_outer_hash.digest();
    const address_type_prefix = Buffer.from([0x00]);
    const payload = Buffer.concat([address_type_prefix, account_id]);
    const chksum_hash1 = crypto.createHash('sha256').update(payload).digest();
    const chksum_hash2 = crypto.createHash('sha256').update(chksum_hash1).digest();
    const checksum =  chksum_hash2.slice(0,4);
    const dataToEncode = Buffer.concat([payload, checksum]);
    const address = base58.encode(dataToEncode);
    return address
}

function ed25519_keypair_from_validator_sk(sk) {
    return ec.keyFromSecret(address_codec.decode(sk).slice(1,33))
}

function xrpl_address_from_validator_sk(sk) {
    var key = ed25519_keypair_from_validator_sk(sk).pubBytes()
    key.unshift('0xED')
    return xrpl_address_from_validator_pk(key, true)
}

function ripple_keypair_from_ed25519_keypair(key) {
    return {
        publicKey: 'ED' + Buffer.from(key.pubBytes()).toString('hex').toUpperCase(),
        privateKey: 'ED' + Buffer.from(key.secret()).toString('hex').toUpperCase()
    }
}

function ripple_keypair_from_validator_sk(sk) {
    return ripple_keypair_from_ed25519_keypair(ed25519_keypair_from_validator_sk(sk))
}

function do_rekey_from_validator_sk(validatorsk, regular_key, server) {
    var rapi = new RippleAPI.RippleAPI({server: server});
    var instructions = {maxLedgerVersionOffset: 5};

    var address = xrpl_address_from_validator_sk(validatorsk);
    var settings = {
        "regularKey": regular_key
    };

    function quit(message) {
      console.log(message);
      process.exit(0);
    }

    function fail(message) {
      console.error(message);
      process.exit(1);
    }

    rapi.connect().then(() => {
      console.log('Connected...');
      return rapi.prepareSettings(address, settings, instructions).then(prepared => {
        console.log('Settings transaction prepared...');
        const {signedTransaction} = rapi.sign(prepared.txJSON, ripple_keypair_from_validator_sk(validatorsk));
        console.log(JSON.parse(prepared.txJSON))
        console.log('Settings transaction signed...');
        rapi.submit(signedTransaction).then(quit, fail);
      });
    }).catch(fail);
    
}

function print_help() {
    console.log("Validator Key Account Generator.")
    console.log("Usage: option [key] [-t] [-f file] [-s server]")
    console.log("Option:")
    console.log("   address   Show the XRPL address corresponding to your validator's key. If a validator pubkey is specified the address for this is shown instead.")
    console.log("   rekey     Set a regular key for the XRPL address corresponding to your validator's key as loaded from the validator-keys.json file")
    console.log("Flags:")
    console.log("   -t        Use Testnet")
    console.log("   -f        Set the location of the validator-keys.json file")
    console.log("   -s        Set the websocket server to connect to (-t overrides this with hardcoded testnet server)")
}

var argv = process.argv
argv.shift()
argv.shift()

function cmdline(argv) {

    var fs = require('fs');
    
    if (argv.length == 0 || argv[0] == 'help')
        return print_help()
  

    // deep copy argv
    var argv2 = []
    for (var x in argv) argv2[x] = argv[x]

    // find flags
    var validatorkeysfile = '/root/.ripple/validator-keys.json'
    var testnet = false
    var server = 'wss://s1.ripple.com'
    for (var x = 0; x < argv.length; x++) {
        if (argv[x] == '-f') {
            if (x+1 >= argv.length) return print_help()
            validatorkeysfile = argv[x+1]
            delete argv2[x]
            delete argv2[x++ +1]
        } else if (argv[x] == '-t') {
            testnet = true 
            delete argv2[x]
        } else if (argv[x] == '-s') {
            if (x+1 >= argv.length) return print_help()
            server = argv[x+1]
            delete argv2[x]
            delete argv2[x++ + 1]
        }
    }

    argv = []
    for (var i in argv2)
        if (argv2[i] !== undefined) argv.push(argv2[i])

    if (argv[0] == 'address' && argv.length >= 2) {
        // in this mode we won't look for a file because the user is specifying an XRPL validator public key
        var r = xrpl_address_from_validator_pk(argv[1])
        console.log('r-Address: ' + r)
        console.log('X-Address: ' + xaddr(r, false))
        return
    }

    // open the file
    var keys = null
    try {
        keys = JSON.parse(fs.readFileSync(validatorkeysfile, 'utf8'))
    } catch (E) {
        return console.log(E)
    }

    if (!keys)
        return console.log("Could not open validator keys file at: " + validatorkeysfile)

    if (!('key_type' in keys && 'public_key' in keys && 'secret_key' in keys))
        return console.log("Sorry the validator file must contain key_type, public_key and secret_key, yours doesn't!")

    if (keys.key_type != 'ed25519')
        return console.log("Sorry this only works for validators using ed25519 keys at the moment!")

    // sanity check the keys    

    var xrpl_addr_from_pk = xrpl_address_from_validator_pk(keys.public_key)
    var xrpl_addr_from_sk = xrpl_address_from_validator_sk(keys.secret_key)
    if (xrpl_addr_from_pk !=  xrpl_addr_from_sk)
        return console.log("Sorry your validator's keys don't appear to match. This might be a bug in this script if your validator running fine.")

    if (argv[0] == 'address') { 
        console.log("Your validator's XRPL r-address is: " + xrpl_addr_from_sk) 
        console.log("Your validator's XRPL X-address is: " + xaddr(xrpl_addr_from_sk, false))
        return
    }

    if (argv[0] == 'rekey') {
        if (argv.length < 2)
            return console.log("You must supply a regular key to set!")
        var regular_key = argv[1]

        // convert from an X-address where applicable
        if (regular_key.substr(0,1) == 'X')
            regular_key = raddr(regular_key).raddr

        // check the regular key is valid
        if (!address_codec.isValidAccountID(regular_key))
            return console.log("Supplied regular key is not valid")

        return do_rekey_from_validator_sk(keys.secret_key, regular_key, ( testnet ? 'wss://s.altnet.rippletest.net:51233' : server )) 
    }

    return print_help()
}

cmdline(argv)
