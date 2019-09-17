# X-Address translation functions
## What is it?
X-addresses are a new packed address format for XRPL addresses that includes, optionally, a built-in destination tag. The motivation is to prevent people ommiting destination tags when sending to and from exchanges. More about the format here:

https://github.com/xrp-community/standards-drafts/issues/6

## Isn't there already a library for this?
Yes, @WietseWind has developed a library here which you are free to use if you wish: https://github.com/xrp-community/xrpl-tagged-address-codec

## Why re-write code
The address format is actually very simple and does not need a new library imho. These two functions depend only on the ripple-address-codec (at previous version ~ 2.0.1) and their inclusion in existing javascript will work in both node projects and in browser. Written for Toast Wallet core.


## Usage
In both functions a tag of false means 'no tag' any other number < 2^32 is a valid tag

```js
> raddr('XVLhHMPHU98es4dbozjVtdWzVrDjtV18pX8yuPT7y4xaEHi')
{ raddr: 'rGWrZyQqhTp9Xu7G5Pkayo7bXjH4k4QYpf', tag: 4294967295 }
> xaddr('rGWrZyQqhTp9Xu7G5Pkayo7bXjH4k4QYpf', 4294967295)
'XVLhHMPHU98es4dbozjVtdWzVrDjtV18pX8yuPT7y4xaEHi'
```

