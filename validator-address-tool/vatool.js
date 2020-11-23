/**

    This is a script for using XRPL validator keys to produce an XRPL address and corresponding private key
    The keys are the same, just reformated to work as an account keypair
    Included is a function to rekey your validator's XRPL account, for ease of use and security

    Version 1.2
    Author: Richard Holland, Robert Zhang
    Date: 22 November 2020

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
const yargs = require('yargs/yargs')
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

function read_keys_file(validatorkeysfile) {
    var fs = require('fs');

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

    return {
      keys: keys,
      xrpl_addr_from_sk: xrpl_addr_from_sk
    }
}

var argv = yargs(process.argv.slice(2))
    .command(['address [pubkey]'],
        'Show the XRPL address corresponding to your validator\'s key. If a validator pubkey is specified, the address for it is shown instead.', (yargs) => {
            yargs.positional('pubkey', {
                describe: 'The public key of your validator',
                type: 'string',
            })
        }, (argv) => {
            if (argv.pubkey) {
                var xrpl_addr_from_pk = xrpl_address_from_validator_pk(argv.pubkey)
                console.log("Your validator's XRPL address is: " + xrpl_addr_from_pk)
                console.log("Your validator's XRPL X-address is: " + xaddr(xrpl_addr_from_pk, false))
                return
            }
            var res  = read_keys_file(argv.f)
            console.log("Your validator's XRPL address is: " + res.xrpl_addr_from_sk)
            console.log("Your validator's XRPL X-address is: " + xaddr(res.xrpl_addr_from_sk, false))

        })
    .command(['rekey <regular_key>'],
        'Set a regular key for the XRPL address corresponding to your validator\'s key as loaded from the validator-keys.json file', (yargs) => {
            yargs.positional('regular_key', {
                describe: 'The public key of the regular key',
                type: 'string',
            })
            .option('testnet', {
                alias: 't',
                type: 'bool',
                describe: 'Use Testnet'
            })
            .option('server', {
                alias: 's',
                type: 'string',
                default: 'wss://s1.ripple.com',
                describe: 'Set the websocket server to connect to (-t overrides this with hardcoded testnet server)'
            })
        }, (argv) => {
            // convert from an X-address where applicable
            if (regular_key.substr(0,1) == 'X')
              regular_key = raddr(argv.regular_key).raddr;

            // check the regular key is valid
            if (!address_codec.isValidAccountID(argv.regular_key))
                return console.log("Supplied regular key is not valid")
            var res = read_keys_file(argv.f)
            return do_rekey_from_validator_sk(res.keys.secret_key, argv.regular_key, ( argv.testnet ? 'wss://s.altnet.rippletest.net:51233' : argv.server ))
        })
    .option('file', {
        alias: 'f',
        type: 'string',
        default: require('os').homedir() + '/.ripple/validator-keys.json',
        describe: 'Set the location of the validator-keys.json file'
    })
    .demandCommand(1, 'Please specify a command')
    .global('file')
    .help('help')
    .argv
