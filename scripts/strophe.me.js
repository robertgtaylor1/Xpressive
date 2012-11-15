function Me(connection) {
	this.conn = connection;
	this.jid = "";
	this.password = "";
	this.status = "";
	this.info = "";
	this.nickname = "";
}
 
Me.prototype.setNickname = function(newNickname) {
	this.nickname = newNickname;

	$(document).trigger('my_status_changed', this);
};


Me.prototype.getNickname = function() {
	
	if ((this.nickname || "").length === 0) {
		return Strophe.getNodeFromJid(this.jid);
	}
	return this.nickname;
};

Me.prototype.setStatus = function(newStatus, newInfo) {
	var oldStatus = this.status;
	
	if (oldStatus === newStatus && (newInfo || "") === this.info) {
		return;
	}
	Strophe.debug("Status change: " + oldStatus + " > " + newStatus + " [" + newInfo + "]");
	
	this.info = newInfo || "";
	this.status = newStatus;

	$(document).trigger('my_status_changed', this);

	if (oldStatus === "connected") {
		this.conn.caps.sendPres();
	} else {
		this.sendPresence();
	}
};

Me.prototype.statusToString = function() {
	var statusObj = {
				unavailable: "Unavailable",
				available: "Online, Available",
				chat: "Chatting",
				away: "Away",
				xa: "Extended Away",
				dnd: "Do not disturb",
				disconnected: "Not connected",
				autherr: "Authorization failed",
				connerr: "Connection failed",
				authenticating : "Authenticating..."
			};
	return statusObj[this.status] || "...processing";		
};

Me.prototype.extendedStatusToString = function() {
	var status = this.statusToString();
	if (this.info.length > 0) {
		status += " : " + this.info;		
	}
	return status;
};

Me.prototype.sendPresence = function() {
	if (this.conn !== undefined) {
		switch (this.status) {
			case "unavailable" :
				this.conn.send($pres({
					type : "unavailable"
					}).tree());
				return;
			case "available":
				this.conn.send($pres());
				return;
			case "away":
			case "xa":
			case "chat":
			case "dnd":
				var pres = 	$pres().c('show', null, this.status);
				if (this.info.length > 0) {
					pres.c('status', null, this.info);
				}
				this.conn.send(pres.tree());
				return;
		}		
	}
};

Strophe.addConnectionPlugin('me', (function() {
	var _connection = null, myDetails = {};

	var init = function(connection) {
		Strophe.debug("init me plugin");

		this._connection = connection;
		this.myDetails = new Me(connection);
		this._connection.addHandler(_onVersionIq.bind(this), Strophe.NS.VERSION, 'iq', 'get', null, null);
		this._this = this;
	};

	var statusChanged = function(status) {
		switch (status) {
			case Strophe.Status.CONNECTED :
				this.myDetails.jid = this._connection.jid;
				this.myDetails.setStatus("connected");
				this._connection.disco.addFeature(Strophe.NS.VERSION);
				break;
			case Strophe.Status.CONNECTING :
				this.myDetails.setStatus("connecting");
				break;
			case Strophe.Status.DISCONNECTING :
				this.myDetails.setStatus("disconnecting");
				break;
			case Strophe.Status.DISCONNECTED :
				this.myDetails.setStatus("disconnected");
				break;
			case Strophe.Status.CONNFAIL :
				this.myDetails.setStatus("connfail");
				break;
			case Strophe.Status.AUTHENTICATING :
				this.myDetails.setStatus("authenticating");
				break;
			case Strophe.Status.AUTHFAIL:
				this.myDetails.setStatus("authfail");
				break;
		}
	};

	var _onVersionIq = function(iq) {
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
	};

	var myJid = function() {
		return Strophe.getBareJidFromJid(this.myDetails.jid);	
	};
	
	var changeStatus = function(status, info) {
		this.myDetails.setStatus(status, info);
	};
	
	var available = function() {
		this.myDetails.setStatus("available");
	};

	var away = function() {
		this.myDetails.setStatus("away");
	};

	var chat = function() {
		this.myDetails.setStatus("chat");
	};

	var xa = function() {
		this.myDetails.setStatus("xa");
	};

	var dnd = function() {
		this.myDetails.setStatus("dnd");
	};

	var offline = function() {
		this.myDetails.setStatus("unavailable");
	};
	
	return {
		init : init,
		statusChanged : statusChanged,
		changeStatus : changeStatus,
		available : available,
		away : away,
		chat : chat,
		xa : xa,
		dnd : dnd,
		offline : offline,
		myJid : myJid
	};
})());
