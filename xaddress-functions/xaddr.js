const rippleAddressCodec = require('ripple-address-codec')

function xaddr(raddr, tag) {
	flag = tag === false ? 0 : tag < 4294967296  ? 1 : 2
	if (flag == 2) return false
	var decoded = rippleAddressCodec.decodeAccountID(raddr)
	if (!decoded) return false
	return rippleAddressCodec.codecs.ripple.encodeChecked([0x05, 0x44].concat(decoded.concat(
		[flag, tag & 0xff, (tag  >> 8) & 0xff, (tag >> 16) & 0xff, (tag >> 24) & 0xff, 0,0,0,0])))
}

function raddr(xaddr) {
	var decoded = rippleAddressCodec.codecs.ripple.decodeChecked(xaddr)
	if (!decoded) return false
	var raddr = rippleAddressCodec.encodeAccountID(decoded.slice(2,22))
	var tag = decoded[22] == 0 ? false : decoded[23] + decoded[24] * 0x100 + decoded[25] * 0x10000 + decoded[26] * 0x1000000
	return decoded[22] > 1 ? false : {raddr: raddr, tag: tag}
}

function addr_test() {
	var tests = [
        ['rGWrZyQqhTp9Xu7G5Pkayo7bXjH4k4QYpf', false,   'XVLhHMPHU98es4dbozjVtdWzVrDjtV5fdx1mHp98tDMoQXb'],
        ['rGWrZyQqhTp9Xu7G5Pkayo7bXjH4k4QYpf', 0,   'XVLhHMPHU98es4dbozjVtdWzVrDjtV8AqEL4xcZj5whKbmc'],
        ['rGWrZyQqhTp9Xu7G5Pkayo7bXjH4k4QYpf', 1,   'XVLhHMPHU98es4dbozjVtdWzVrDjtV8xvjGQTYPiAx6gwDC'],
        ['rGWrZyQqhTp9Xu7G5Pkayo7bXjH4k4QYpf', 2,   'XVLhHMPHU98es4dbozjVtdWzVrDjtV8zpDURx7DzBCkrQE7'],
        ['rGWrZyQqhTp9Xu7G5Pkayo7bXjH4k4QYpf', 32,  'XVLhHMPHU98es4dbozjVtdWzVrDjtVoYiC9UvKfjKar4LJe'],
        ['rGWrZyQqhTp9Xu7G5Pkayo7bXjH4k4QYpf', 276, 'XVLhHMPHU98es4dbozjVtdWzVrDjtVoKj3MnFGMXEFMnvJV'],
        ['rGWrZyQqhTp9Xu7G5Pkayo7bXjH4k4QYpf', 65591,   'XVLhHMPHU98es4dbozjVtdWzVrDjtVozpjdhPQVdt3ghaWw'],
        ['rGWrZyQqhTp9Xu7G5Pkayo7bXjH4k4QYpf', 16781933,    'XVLhHMPHU98es4dbozjVtdWzVrDjtVqrDUk2vDpkTjPsY73'],
        ['rGWrZyQqhTp9Xu7G5Pkayo7bXjH4k4QYpf', 4294967294,  'XVLhHMPHU98es4dbozjVtdWzVrDjtV1kAsixQTdMjbWi39u'],
        ['rGWrZyQqhTp9Xu7G5Pkayo7bXjH4k4QYpf', 4294967295,  'XVLhHMPHU98es4dbozjVtdWzVrDjtV18pX8yuPT7y4xaEHi'],
        ['rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY', false,  'XV5sbjUmgPpvXv4ixFWZ5ptAYZ6PD2gYsjNFQLKYW33DzBm'],
        ['rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY', 0,  'XV5sbjUmgPpvXv4ixFWZ5ptAYZ6PD2m4Er6SnvjVLpMWPjR'],
        ['rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY', 13371337,  'XV5sbjUmgPpvXv4ixFWZ5ptAYZ6PD2qwGkhgc48zzcx6Gkr']

    ]
    var allpassed = true
	for (var test_no in tests) {
		var test = tests[test_no]
		console.log('runing test' + JSON.stringify(test))
		var x = xaddr(test[0], test[1])
		var r = raddr(test[2])
		var xx = xaddr(r.raddr, r.tag)
		var rr = raddr(x)
		console.log(rr)
        console.log(xx)
		if (r.raddr != test[0] && r.tag != test[1] ||
		    x != test[2] ||
		    xx != x || 
	 	    rr.raddr != r.raddr || 
		    rr.tag != r.tag
	              ) {
			    console.log("!!!!!!!!!!FAILED")
                allpassed = false
            }
	       else console.log('passed')
	}

    console.log(allpassed ? 'ALL PASSED' : 'NOT ALL TESTS PASSED' )
}

addr_test()
