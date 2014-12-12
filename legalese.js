// #### A non-trivial rule-based contract design library for Javascript.
// ##### Version 0.1.0
//    Copyright (c) 2014 Flávio Lisbôa
//    
//    This software may be modified and distributed under the terms
//    of the MIT license.  For more details, see
//    http://github.com/flisboac/legalese.js/
//    
// -----

// *TODO: Some explanation of the library here.*

// *TODO: Explanation.*
// The main entry point of the library's functionalities is the `legal`
// function.
export default function legal(contractor, constructor = null, propertyName = null) {
  var previousContract = contractor[CONTRACT_PROPERTY_NAME];
  if (previousContract) {
    return previousContract;
  } else {
    let contract;
    if (typeof constructor === 'function' && typeof propertyName === 'string') {
      /* New instance method */
      constructor.prototype[propertyName] = contractor;
      contract = new legal.Contract(null, propertyName, constructor);
      
    } else if (typeof constructor === 'string') {
      /* Existing instance method */
      contract = new legal.Contract(null, propertyName, contractor);
      
    } else {
      /* Constructor, function or object */
      contract = new legal.Contract(contractor);
    }
    return contract;
  }
}


// The library's version.
legal.VERSION = '0.1.0';


// This is the default property name used when afixing the contract into the
// object that is bound by said contract (or, in the library's terminology, the
// contractor). It's advised for users to retrieve the contract with
// `legal(object)` instead of trying to access the property directly (e.g.
// `object.$contract`).
var CONTRACT_PROPERTY_NAME = "$contract";


// These constants are mere defaults used when defining a clause's level.
// When checking if a clause should be executed or not, the default bind
// selector `legal.bound.selector` will filter clauses and select for validation
// only those that have a level greater than or equal to
// `legal.DEFAULT_BINDING`.
legal.PRODUCTION = 4;
legal.TESTING = 3;
legal.DEVELOPMENT = 2;
legal.DEBUG = 1;
legal.DEFAULT_BINDING = legal.DEVELOPMENT;


// Each clause in a contract must be properly classified with a so called type.
// From its type, the clause may be skipped, executed or used in different ways
// in `legal.Court` validations. Their meanings should be pretty
// straightforward if one looks into the `legal.Contract` functions. Here
// is a brief explanation of each clause type:
// - `legal.REQUIREMENT`: A *functional requirement*, applied before function
//   execution or object instantiation. Declared through
//   `legal.Contract.require()`.
// - `legal.GUARANTEE`: A *functional guarantee*, applied after function execution
//   or object instantiation. Declared through `legal.Contract.guarantee()`.
// - `legal.INVARIANT`: An *object invariant*, checked before and after each
//   method execution. Invariants are applied before Requirements (if not in a
//   constructor) and after Guarantees. Declared through
//   `legal.Contract.invariant()`.
// - `legal.DECORATOR`: A *functional decorator* applied before any of the
//   checks. Decorations generate new functions to replace the previous one.
//   Think Python decorators and you'll be good to go. Declared through
//   `legal.Contract.decorate()`.
// - `legal.THROW`: Guards used to identify invalid or unexpected throws during
//   function execution. Kind of similar to Java's `throws` notation. Declared
//   through `legal.Contract.throws()`.
legal.REQUIREMENT = 'requirement';
legal.GUARANTEE = 'guarantee';
legal.INVARIANT = 'invariant';
legal.DECORATOR = 'decorator';
legal.THROW = 'throw';


// This is the default error class for the library.
// There's nothing that much complex about this class, except for the
// `this.stack` and `this.error` properties. `this.stack` may not be always
// available, as it depends on the interpreter's support (e.g. IE may not
// support it). `this.error` is set to another thrown object that was captured
// and encapsulated by the library during a validation.
legal.Error = class Error {
  constructor(message = "An error ocurred.") {
    this.message = message;
    this.stack = (new Error()).stack;
    this.error = null;
  }
  get name() { return "legal.Error"; }
  toString() { return (this.name ? "(" + this.name + ") " : "") + this.message }
}


// `legal.Breach` is the specific error class for contract breaches.
// It is thrown during validation whenever any contract clause is
// violated. Throwing sites should provide the `court` (a fancy name for
// the module's validator) and, in case of a throw capture (e.g. a thrown object
// that is not allowed by the contract), the `error`
legal.Breach = class Breach extends Error {
  constructor(court, message = "A breach of contract was found.") {
    super(message);
    this.court = court;
  }
  get name() { return "legal.Breach"; }
}


// A fancy namespace to separate what is "ends" from what is "means".
legal.helper = {};


// Helper class used to access and assign properties to objects by using a
// string notation.
// `target` is the object being wrapped. `fullName` is the name of a property
// that can be prefixed with `get` (the property is only a getter), `set`
// (the property is only a setter), `
legal.helper.Property = class Property {
  constructor(target, fullName) {
    this.target = target;
    this.fullName = fullName;
    this.defaults = {
      enumerable: true, configurable: true, writable: this.isValue
    };
  }
  set getter(fn) {
    var desc = this.defaultDescriptor;
    this.descriptor.get = fn;
    return this.describe(desc);
  }
  set setter(fn) {
    var desc = this.defaultDescriptor;
    this.descriptor.set = fn;
    return this.describe(desc);
  }
  accessor(getfn, setfn) {
    var desc = this.defaultDescriptor;
    this.descriptor.get = getfn;
    this.descriptor.set = setfn;
    return this.describe(desc);
  }
  set value(value) {
    var desc = this.defaultDescriptor;
    this.descriptor.value = value;
    return this.describe(desc);
  }
  get site() {
    if (!(this.name in this.target) || Object.hasOwnProperty(this.target, this.name)) {
      return target;
    } else {
      let site = this.target;
      while (site) {
        site = Object.getPrototypeOf(site);
        if (Object.hasOwnProperty(site, this.name)) {
          return site;
        }
      }
    }
  }
  del() {
    delete this.target[this.name];
  }
  validate(descriptor) {
    if ('get' in descriptor && !this.isGetter) {
      return new legal.Error("Property '" + this.fullName + "' is not a getter.");
    }
    if ('set' in descriptor && !this.isSetter) {
      return new legal.Error("Property '" + this.fullName + "' is not a setter.");
    }
    if (this.isAccessor && !('set' in descriptor && 'get' in descriptor)) {
      return new legal.Error("Accessor property '" + this.fullName + "' must provide both getter and setter.");
    }
    if (this.isValue && !('value' in descriptor)) {
      return new legal.Error("Value not specified for value property '" + this.fullName + "'.");
    }
  }
  describe(descriptor) {
    var err = this.validate(descriptor);
    if (err) {
      throw err;
    }
    return Object.setOwnPropertyDescriptor(this.site, this.name, descriptor);
  }
  get defaultDescriptor() {
    var desc = this.descriptor;
    for (key in this.defaults) {
      desc[key] = this.defaults[key];
    }
    return desc;
  }
  
  // Lots of getters.
  get descriptor() { return Object.getOwnPropertyDescriptor(this.site, this.name); }
  get value() { return this.descriptor.value; }
  get getter() { return this.descriptor.get; }
  get setter() { return this.descriptor.set; }
  get isGetter() { return this.fullName.search(/^(get|prop)\s+/) == 0; }
  get isSetter() { return this.fullName.search(/^(set|prop)\s+/) == 0; }
  get isAccessor() { return this.fullName.search(/^prop\s+/) == 0; }
  get isValue() { return !(this.isGetter || this.isSetter || this.isAccessor); }
  get isDefined() { return this.name in this.target; }
  get isInstanceProperty() { return this.site !== this.target; }
  get isOwnProperty() { return this.site === this.target; }
  get name() { return this.fullName.replace(/^(get|set)\s+/, ""); }
}


// `legal.Clause` is a class that holds data to be used by `legal.Court` checks.
// Only `legal.Clause.rule` required to be assigned a function for a clause to
// be considered valid. Though, the function signature is dependent exclusively
// to the clause's type.
legal.Clause = class Clause {
  constructor(data = {}) {
    var opts = Object.create(data);
    if (!('level' in opts)) opts.level = legal.DEFAULT_BINDING;
    if (!('type' in opts)) opts.type = 'rule';
    if (!('rule' in opts)) opts.rule = null;
    if (!('help' in opts)) opts.help = null;
    for (key in opts) {
      this[key] = opts[key];
    }
  }
  toString() { return "[" + this.rule + "@" + this.level + "] " + this.help; }
  get valid() { return typeof this.rule === 'function'; }
}


function clauseItemSplit(clauses, items, mutator) {
  var item = null;
  for (arg of clauses) {
    let clause;
    if (arg) { 
      if (typeof arg === 'object') {
        clause = new legal.Clause(arg);
        mutator(clause);
        items.push(clause);
      } else {
        item = item || {};
        if (typeof arg === 'function') {
          if (item.rule) {
            clause = new legal.Clause(item);
            mutator(clause);
            items.push(clause);
            item = {};
          }
          item.rule = arg;
        } else if (typeof arg === 'string') {
          item.help = arg;
        } else if (typeof arg === 'number') {
          item.level = arg;
        }
      }
    }
  }
  if (item && item.rule) {
    let clause = new legal.Clause(item);
    mutator(clause);
    items.push(clause);
  }
}


// `legal.Contract` aggregates clauses and contractor, and provides useful
// functions to manipulate them.
//
// `this.contractor` is the object bound by the contract. Similarly,
// `this.target` points to the original object *before* binding, so that the
// original object can be bound again or retrieved if the need arise. If the
// contract is bound to a "class" constructor, `this.target` is used to
// instantiate the new object.
//
// `this.constructor` points to the function holding the prototype where
// `this.contractor` is located. `this.propertyName` is the name of the
// contractor in the constructor's prototype. These properties are used to
// reassign contractors that are "instance method" of some "class". For example,
// after binding, the assignment
// `this.constructor.prototype[this.propertyName] = this.contractor` is done
// automatically by means of those properties. Similarly, the contractor can
// be considered a "class" if `this.constructor` is null. Also,
// `this.constructor` is used to obtain the invariants.
legal.Contract = class Contract {
  constructor(target = null, propertyName = null, constructor = null) {
    this.contractor = target;
    this.constructor = constructor;
    this.propertyName = propertyName;
    this.invariants = [];
    this.requirements = [];
    this.guarantees = [];
    this.decorations = [];
    this.safety = null; // exception safety information
    this.target = target;
    this.bindSelector = legal.bound.ge;
  }
  
  // TODO documentation.
  invariant(...clauses) {
    clauseItemSplit(clauses, this.invariants, function (clause) {
      clause.type = legal.INVARIANT;
    });
    return this;
  }
  
  // TODO documentation.
  require(...clauses) {
    clauseItemSplit(clauses, this.requirements, function (clause) {
      clause.type = legal.REQUIREMENT;
    });
    return this;
  }
  
  // TODO documentation.
  guarantee(...clauses) {
    clauseItemSplit(clauses, this.guarantees, function (clause) {
      clause.type = legal.GUARANTEE;
    });
    return this;
  }
  
  // TODO documentation.
  nothrow() {
    this.safety = null;
    return this;
  }
  
  // TODO documentation.
  throws(...throwables) {
    this.safety = this.safety || [];
    clauseItemSplit(clauses, this.safety, function (clause) {
      clause.type = legal.THROW;
    });
    return this;
  }
  
  // TODO documentation.
  decorate(...functions) {
    clauseItemSplit(clauses, this.decorations, function (clause) {
      clause.type = legal.DECORATOR;
    });
    return this;
  }
  
  // TODO documentation.
  body(func) {
    this.target = func;
    return this;
  }
  
  // TODO documentation.
  ammend(otherContract, properties = null) {
    if (typeof properties === 'string') {
      properties = [properties];
    }
    
    // These properties should not really be changed, because we could
    // potentially bind the same target twice with an overlapping set of
    // clause checks. It all depends on whether `otherContract.target` is
    // already bound or not by `otherContract` itself.
    // But, if so wants the user, we do it, as long as they're
    // not already defined. We hope the user knows what he's doing.
    if (properties && properties.includes('contractor'))
      this.contractor = this.contractor || otherContract.contractor;
    if (properties && properties.includes('constructor'))
      this.constructor = this.constructor || otherContract.constructor;
    if (properties && properties.includes('propertyName'))
      this.propertyName = this.propertyName || otherContract.propertyName;
    if (properties && properties.includes('target'))
      this.target = this.target || otherContract.target;
        
    // An ammended (push-merged) contract will contain a coherent clauses' set
    // if they both use the same selector. Else, we could be passing clauses
    // for which the selector does not know how to select, or would select in a
    // wrong way (e.g. `clause.level` is set to an object literal and the
    // selector expects it to be a number).
    //
    // All rule-based properties are merged by default, unless the user
    // explicitly specifies which properties to merge.
    if (this.bindSelector === other.bindSelector) {
      if (!properties || properties.includes('invariants'))
        otherContract.invariants.forEach((item) => this.invariants.push(item));
      if (!properties || properties.includes('requirements'))
        otherContract.requirements.forEach((item) => this.requirements.push(item));
      if (!properties || properties.includes('guarantees'))
        otherContract.guarantees.forEach((item) => this.guarantees.push(item));
      if (!properties || properties.includes('decorations'))
        otherContract.decorations.forEach((item) => this.decorations.push(item));
      if (otherContract.safety && (!properties || properties.includes('safety'))) {
        this.safety = this.safety || [];
        otherContract.safety.forEach((item) => this.safety.push(item));
      }
    }
    return this;
  }
  
  // TODO documentation.
  bind(selector = null) {
    this.bindSelector = selector || this.bindSelector;
    
  }
  
  // TODO documentation.
  bindClass(selector = null) {}
  
  // TODO documentation.
  unbind() {}
  
  // TODO documentation.
  trial(goods = null) {}
  
  // TODO documentation.
  get bound() { return this.target !== this.contractor; }
}


// TODO documentation.
legal.Court = class Court {
  constructor(contract, goods = null) {
    this.contract = contract;
    this.goods = goods;
    this.breach = null;
    //this.result = null;
  }
  
  // TODO documentation.
  pre() {}
  
  // TODO documentation.
  post() {}
  
  // TODO documentation.
  run(...resultValue) {}
  
  // TODO documentation.
  done(...resultValue) {}
  
  // TODO documentation.
  hasResult() {}
  
  // TODO documentation.
  summon() {}
  
  // TODO documentation.
  order() {}
}


// I'm just... Reserving this name.
legal.selector = function bound() {}


// TODO documentation.
legal.selector.ge = function selector_ge(contract, rule) {
  return Number(rule.level) >= legal.DEFAULT_BINDING;
}


// TODO documentation.
legal.rule = function rule(key, ...args) {
  var data = {},
    handlers = {
      constructor: function handler_constructor(self, thrown) {},
      objtype: function handler_objtype(self, thrown) {},
      equals: function handler_equals(self, thrown) {},
      notEquals: function handler_notEquals(self, thrown) {},
      strictEquals: function handler_strictEquals(self, thrown) {},
      strictNotEquals: function handler_strictNotEquals(self, thrown) {},
      match: function handler_match(self, thrown) {},
      noMatch: function handler_noMatch(self, thrown) {},
      objectMatch: function handler_objectMatch(self, thrown) {},
      objectNoMatch: function handler_objectNoMatch(self, thrown) {},
      any: function handler_any(self, thrown) {},
      all: function handler_all(self, thrown) {}
    };
  if (!(key in handlers)) {
    throw legal.Error("Unknown thrown rule handler '" + key + "'.");
  }
  return handlers[key];
}
