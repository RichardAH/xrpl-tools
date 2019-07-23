/**
    This is a client-side POW benchmark script to examine how expensive various memos would be to send to the XRPL under 
    various proof of work bit_per_byte costs. Some effort has been made to ensure the POW is calculated efficiently so that
    the benchmark results are accurate for consumer devices computing POW in javascript.

    Version: 1.0
    Author: Richard Holland
    Date: 24 July 2019
**/

const crypto = require('crypto')

function pow_benchmark (memo_payload, pow_cost_bits_per_byte) {
    var pow_bits_required = Math.floor(pow_cost_bits_per_byte * memo_payload.length)
    var pow_nibble_boundary = Math.ceil(pow_bits_required / 4.0)
    var shift_right = pow_nibble_boundary * 4.0 - pow_bits_required
    var hash = "", nonce = 0
    var mask = (1 << pow_bits_required) - 1
    var hrstart = process.hrtime()
    for (;; ++nonce) {
        hash = crypto.createHmac('sha512', memo_payload + " " + nonce).digest('hex')
        // check the work
        var field = parseInt(hash.slice(0, pow_nibble_boundary),16) >>> shift_right
        if (field === mask) break
    }
    var hrend = process.hrtime()
    var time_taken = ((hrend[0] * 1e9 + hrend[1]) - (hrstart[0] * 1e9 + hrstart[1]))/1e6
    return {time_taken: time_taken, nonce: nonce, pow_bits_required: pow_bits_required, pow_cost_bits_per_byte: pow_cost_bits_per_byte, memo_length: memo_payload.length}
}

// you can change the following 5 consts to adjust the benchmark
const pow_cost_bits_per_byte = 0.4 
const trials_per_length = 100 // proof of work is statistical so we need to run many trials to get a time cost estimate
const max_length = 150 // max length of the memos to try
const min_length = 8 // min length of the memos to try
const step = 5 // how many lengths to skip each mark

// run the benchmark
var result_stack = []
console.log("pow cost in bits per byte: " + pow_cost_bits_per_byte)
console.log("running " + trials_per_length + " trials per memo length")
for (var memo_length = min_length; memo_length < max_length; memo_length += step) {
    var total_time = 0
    for (var trials = 0; trials < trials_per_length; ++trials)  {
        var memo_payload = String.fromCharCode(trials).repeat(memo_length)
        var result = pow_benchmark(memo_payload, pow_cost_bits_per_byte)
        total_time += result.time_taken
    }
   
    var average_time = Math.floor((total_time / trials)*1000.0)/1000.0
    console.log("memo length: " + memo_length + " -> " + average_time + " ms") 
    result_stack[memo_length] = average_time
}

//console.log(result_stack)
