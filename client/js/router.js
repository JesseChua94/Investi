Router.configure({
	layoutTemplate: 'layout' 
});

Router.map(function() {
	this.route('Children', {path: '/'});
	this.route('Parents', {path: '/parents'});
	this.route('Dashboard', {path: '/dashboard'});
	this.route('Investment', {path: '/investment'});

});