import { Signature, PublicKey } from "@nimiq/core";
console.log("Signature methods:", Object.getOwnPropertyNames(Signature.prototype));
console.log("PublicKey methods:", Object.getOwnPropertyNames(PublicKey.prototype));
