This is an Xmpp client project.
*******************************

It is built on the Strophe.js library.

It also uses jQuery, jQueryUI and jStorage.

I have included a number of Strophe enhancements and fixes. The main one is support 
for both BOSH & WebSockets details of which can be found here: https://github.com/metajack/strophejs/pull/95

The client currently supports:

	Basic chat
	XEP-0045	muc (partial)
	XEP-0004	xData Forms
	XEP-0030	Service Discovery

This project has now been replaced by Xpressive2 which is a reworking of this using Typescript.

Details of Typescript can be found here http://http://www.typescriptlang.org/. It is a javascript pre-processor from Microsoft that helps when it comes to writing js code. It provides intellisense and allows you to add type annotations to var's, define classes (like you have in other languagues) and modules (which are more akin to namespaces). It also allows you to use the '=>' notation for anonymous functions that manipulates the 'this' value for you; so no more 'that = this' :-).