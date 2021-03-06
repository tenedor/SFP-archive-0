(function(){

// d3.selection.delegate
// jQuery-style event delegation
//
// NOTE: listeners bound with delegate are called with selection data from the
// selection they are bound to, NOT the subselection on which delegated events
// are interpreted.
//
// Adapted from jQuery 2.1.3 source.
d3.selection.prototype.delegate = function(type, selector, listener, capture) {
  var delegateSource, special, _listener;

  delegateSource = this.node();

  special = this.delegate.special[type];
  if (special) {
    special.delegateType && (type = special.delegateType + '.+' + type);
    special.wrapListener && (listener = special.wrapListener(listener));
  };

  type += (selector[0] === '.' ? selector : '.' + selector);

  _listener = listener;
  listener = function() {
    var target = d3.event.target;
    while (target !== delegateSource && target.parentNode) {
      if (!d3.select(target).filter(selector).empty()) {
        _listener.apply(target, arguments);
      };
      target = target.parentNode;
    };
  };

  return this.on(type, listener, capture);
};

d3.selection.prototype.delegate.special = {};
_.each({
  mouseenter: "mouseover",
  mouseleave: "mouseout",
  pointerenter: "pointerover",
  pointerleave: "pointerout"
}, function(fix, orig) {
  d3.selection.prototype.delegate.special[orig] = {
    delegateType: fix,

    wrapListener: function(listener) {
      return function(){
        var target, related, eventType, ret;

        target = this;
        related = d3.event.relatedTarget;

        // For mousenter/leave call the handler if related is outside the target.
        // NB: No relatedTarget if the mouse left/entered the browser window
        if (!related || !(target === related || $.contains(target, related))) {
          eventType = d3.event.type;
          d3.event.type = orig;
          ret = listener.apply(this, arguments);
          d3.event.type = eventType;
        };
        return ret;
      };
    }
  };
});

}).call(this);
