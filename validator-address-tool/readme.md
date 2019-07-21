# Validator Address Tool
## What is this?
Validators use a keypair to publish validations to the XRPL mesh network, like this:
> nHBtDzdRDykxiuv7uSMPTcGexNm879RUUz5GW4h1qgjbtyvWZ1LE
These same keys can be used in an account context on the XRPL. 
>$ node vatool.js address nHBtDzdRDykxiuv7uSMPTcGexNm879RUUz5GW4h1qgjbtyvWZ1LE
>[Output:] rHiJahydBswnAUMZk5yhTjTvcjBE1fXAGh

Using the validator's key repeatedly to make transactions on this account would be insecure and cumbersome, so instead let's send 20 XRP to the address and then rekey the account by using the tool to set a regular key. This step requires access to the validator's key file.

>$ node vatool.js rekey rnkQDducQUwheiGY6z2Wk6FG6xu9oZf55y
>[...] resultCode: 'tesSUCCESS',

Now the validator can access his account from Toast or any other wallet.

This is intended to help with validator incentives in the future.

