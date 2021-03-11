const jwt_decode = require('jwt-decode');
const { ElastosClient } = require("@elastosfoundation/elastos-js-sdk");
const { HiveClient, OptionsBuilder } = require("../dist/HiveClient")
const fetch = require("node-fetch");

if (!globalThis.fetch) {
	globalThis.fetch = fetch;
}

let generateUserVerifiablePresentation = async (appDid, user, appChallenge, appId) => {
    let userDid = await ElastosClient.did.loadFromMnemonic(user)
    let jwt = jwt_decode(appChallenge.challenge);
    let iss = jwt.iss;
    let nonce = jwt.nonce;
    let vc = ElastosClient.didDocuments.createVerifiableCredentialVP(appDid, userDid, appId)
    return ElastosClient.didDocuments.createVerifiablePresentation(appDid, "VerifiablePresentation", vc, iss, nonce)
}

let getApplicationDIDDocument = async (appDid) => {
    
    let document = ElastosClient.didDocuments.newDIDDocument(appDid)
    ElastosClient.didDocuments.sealDocument(appDid, document)
    return document
}

module.exports.testHelper = {
    getHiveInstance: async (app, user, url, appId) => {
        let appDid = await ElastosClient.did.loadFromMnemonic(app)
        let builder = new OptionsBuilder()
        await builder.setAppInstance(appId, appDid)
        builder.setHiveHost(url)
        let options = builder.build()
        let appDocument = await getApplicationDIDDocument(appDid);
        let challenge = await HiveClient.getApplicationChallenge(options, appDocument)
        let vp = await generateUserVerifiablePresentation(appDid, user, challenge, appId)
        let token = await HiveClient.getAuthenticationToken(options, vp)
        return await HiveClient.createInstance(token, url);
    },
    getAnonymousHiveInstance: async (hiveUrl) => {
        return await HiveClient.createAnonymousInstance(hiveUrl)
    }
};