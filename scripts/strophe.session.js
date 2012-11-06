function Session(connection) {
	this.conn = connection;
	this.jid = function () {
		return Strophe.getDomainFromJid(this.conn.jid);
		};	
	this.discoInfo = {};
	this.discoItems = {};
};

Session.prototype = {		
	onDiscoInfo : function(iq) {
		Strophe.info("got disco#info response.");
		this.discoInfo = iq;
		
		// Get info
		var discoItemsIq = $iq({
			to : this.jid,
			type : 'get'
		}).c('query', {
			xmlns : Strophe.NS.DISCO_ITEMS
		});

		Strophe.info("request disco#items.");
		this.conn.sendIQ(discoItemsIq, this.onDiscoItems.bind(this), this.onItemsError.bind(this));
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
		this.discoItems = iq;
		
		if (this.conn.muc){
			this.conn.muc.processDiscoItems(iq);
		}
		if (this.conn.pubsub){
			this.conn.pubsub.processDiscoItems(iq);
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

Strophe.addConnectionPlugin('session', (function() {
	var init, statusChanged, disconnect, unhandledIq;
	var _conn, _session;
	
	init = function(connection) {
		Strophe.debug("init session plugin");

		_conn = connection;
		_session = new Session(_conn);
	};

	// called when connection status is changed
	statusChanged = function(status) {
		if (status === Strophe.Status.CONNECTED || status === Strophe.Status.ATTACHED) {

			_session.jid = Strophe.getDomainFromJid(_conn.jid)
			// Get info
			var discoInfo = $iq({
				type : 'get'
			}).c('query', {
				xmlns : Strophe.NS.DISCO_INFO
			});
			Strophe.info("request info");
			_conn.sendIQ(discoInfo, _session.onDiscoInfo.bind(_session), _session.onInfoError.bind(_session));
			//this.connection.addHandler(this.unhandledIq, null, 'iq', 'get', null, null);
		} else if (status === Strophe.Status.DISCONNECTED) {
			_session.discoInfo = {};
		}
	};

	disconnect = function() {
		_conn.disconnect();
	};
	
	unhandledIq = function(iq) {
		Strophe.info("Unhandled Iq");
		return true;	
	};
	
	return {
		init : init,
		statusChanged : statusChanged,
		disconnect : disconnect,
		unhandledIq : unhandledIq
	}
})());
