function Session(connection) {
	this.jid = connection.jid;
	this.connection = connection;
	//this._this = this;
	this.discoInfo = {};
	this.discoItems = {};
}

Session.prototype = {
		
	onDiscoInfo : function(iq) {
		Strophe.info("got disco#info response.");
		this.discoInfo = iq;
		
		_jid = Strophe.getDomainFromJid(this.session.jid)
		// Get info
		var discoItems = $iq({
			to : _jid,
			type : 'get'
		}).c('query', {
			xmlns : Strophe.NS.DISCO_ITEMS
		});

		Strophe.info("request disco#items.");
		this.session.connection.sendIQ(discoItems, this.session.onDiscoItems.bind(this), this.session.onItemsError.bind(this));
	},

	onInfoError : function(iq) {
		if (iq === null) {
			Strophe.warn("disco#info timed out.");
		} else {
			Strophe.error("disco#info returned an error.")
		}
	},
	
	onDiscoItems : function(iq) {
		Strophe.info("got disco#items response.");
		this.session.discoItems = iq;
		
		if (this.session.connection.muc){
			this.session.connection.muc.processDiscoItems(iq);
		}
		if (this.session.connection.pubsub){
			this.session.connection.pubsub.processDiscoItems(iq);
		}
	},

	onItemsError : function(iq) {
		if (iq === null) {
			Strophe.warn("disco#info timed out.");
		} else {
			Strophe.error("disco#info returned an error.")
		}
	}
};

Strophe.addConnectionPlugin('session', {

	init : function(connection) {
		Strophe.debug("init session plugin");

		this.connection = connection;
		this.session = new Session(connection);
	},

	// called when connection status is changed
	statusChanged : function(status) {
		if (status === Strophe.Status.CONNECTED || status === Strophe.Status.ATTACHED) {

			this.session.jid = Strophe.getDomainFromJid(this.connection.jid)
			// Get info
			var discoInfo = $iq({
				type : 'get'
			}).c('query', {
				xmlns : Strophe.NS.DISCO_INFO
			});
			Strophe.info("request info");
			this.connection.sendIQ(discoInfo, this.session.onDiscoInfo.bind(this), this.session.onInfoError.bind(this));
			//this.connection.addHandler(this.unhandledIq, null, 'iq', 'get', null, null);
		} else if (status === Strophe.Status.DISCONNECTED) {
			this.session.discoInfo = {};
		}
	},

	disconnect : function() {
		this.connection.disconnect();
	},
	
	unhandledIq : function(iq) {
		Strophe.info("Unhandled Iq");
		return true;	
	}
});
