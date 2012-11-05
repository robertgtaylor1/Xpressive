function Me(jid, password) {
	this.jid = "";
	this.password = "";
	this.status = "";
}

Strophe.addConnectionPlugin('me', {
	_connection : null,
	myDetails : {},
	_this : {},

	init : function(connection) {
		Strophe.debug("init me plugin");

		this._connection = connection;
		this.myDetails = {};
		connection.addHandler(this._onVersionIq.bind(this), Strophe.NS.VERSION, 'iq', 'get', null, null);
		this._this = this;
	},

	statusChanged : function(status) {
		if (status === Strophe.Status.CONNECTED) {
			this.myDetails = new Me(this._connection.jid, "");
			this._connection.disco.addFeature(Strophe.NS.VERSION);
		}
	},

	_onVersionIq : function(iq) {
		var stanza = $(iq);

		var id = stanza.attr('id');
		var from = stanza.attr('from');
		var iqresult = $iq({
			to : from,
			type : 'result',
			id : id
		});

		iqresult.c('query', {
			xmlns : Strophe.NS.VERSION
		}).c('name', null, 'XpressiveJS').c('version', null, '0.1');

		this._connection.send(iqresult.tree());
		return true;
	},

	available : function() {
		if (this.myDetails.status === "") {
			this._connection.caps.sendPres();
		} else {
			this._connection.send($pres().tree());
		}
		this.myDetails.status = "available";
	},

	away : function() {
		this.myDetails = "away";
		this._sendPres('away');
	},

	chat : function() {
		this.myDetails = "chat";
		this._sendPres('chat');
	},

	xa : function() {
		this.myDetails = "xa";
		this._sendPres('xa');
	},

	dnd : function() {
		this.myDetails = "dnd";
		this._sendPres('dnd');
	},

	offline : function() {
		this.myDetails = "unavailable";
		this._connection.send($pres({
			type : "unavailable"
		}).tree());
	},

	_sendPres : function(show) {
		this._connection.send($pres().c('show', null, show).tree());
	},
});
