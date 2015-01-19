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
export default function legal(contractor = null, propertyName = null) {
  var previousContract = contractor ? contractor[CONTRACT_PROPERTY_NAME] : null;
  if (previousContract) {
    return previousContract;
  } else {
    return new Contract(contractor, propertyName)
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


// TODO: Documentation.
legal.CLASS = 'class';
legal.INSTANCE = 'instance';


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
// (the property is only a setter), `prop` (when property is both a getter
// and setter) or nothing (when the property is a purely value-based one, with
// no function-based value interception).
legal.helper.Property = class Property {
  constructor(target, fullName, targetType = legal.INSTANCE) {
    this.target = target;
    this.fullName = fullName;
    this.targetType = targetType;
    this.defaults = {
      enumerable: true, configurable: true, writable: this.isValue
    };
    if (this.isValue) {
      let desc = this.descriptor;
      if ('get' in desc && 'set' in descriptor) {
        this.fullName = 'prop ' + this.fullName;
      } else if ('get' in desc) {
        this.fullName = 'get ' + this.fullName;
      } else if ('set' in desc) {
        this.fullName = 'set ' + this.fullName;
      }
    }
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
      let site = this.targetType === legal.INSTANCE ? this.target : this.target.prototype;
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


legal.helper.Signature = class Signature {
  constructor(args = null, ret = null, catches = null, help = null) {
    this.help = help;
    this.safety = null;
    this.arguments = null; // null matches anything
    this.returnType = null; // null matches anything
    
    function parse(arg, obj = {}) {
      switch(true) {
      case isString(arg):
        obj.rule = ((a) => (self, obj) => typeof obj === a )(arg);
        return obj;
      case isFunction(arg):
        obj.constructor = arg;
        switch(arg) {
        case Array:
          obj.rule = (self, obj) => isArray(obj);
          break;
        case Function:
          obj.rule = (self, obj) => isFunction(obj);
          break;
        case String:
          obj.rule = (self, obj) => isString(obj);
          break;
        case Number:
          obj.rule = (self, obj) => isNumber(obj);
          break;
        case Boolean:
          obj.rule = (self, obj) => isBoolean(obj);
          break;
        default:
          obj.rule = ((a) => (self, obj) => obj instanceof a )(arg);
          break;
        }
        return obj;
      case isObject(arg):
        for (k in arg) {
          obj[k] = arg[k];
        }
        return obj;
      //case isBoolean(arg):
        /* Could be "if true, argument must be provided, regardless of type;
         * if false, argument must not be given." I'll leave it for the
         * future, IF needed.
         * obj.rule = ((a) => (self, obj) => a && Boolean(obj) )(arg);
         */
      }
    }
    
    if (args) {
      this.arguments = [];
      let index = 0;
      for (arg of args) {
        let obj = parse(arg);
        obj.index = index++;
        this.arguments.push(obj);
      }
    }
    if (ret) {
      this.returnType = parse(ret);
    }
    if (catches) {
      this.safety = [];
      let index = 0;
      for (arg of catches) {
        let obj = parse(arg);
        obj.index = index++;
        this.safety.push(obj);
      }
    }
  }
  nothrow() {
    this.safety = [];
    return this;
  }
  throws(...clauses) {
    this.safety = this.safety || [];
    clauseItemSplit(clauses, this.safety, function (clause) {
      clause.type = legal.THROW;
    });
    return this;
  }
  match(self, ...args) {
    var flag = true;
    if (this.arguments.length) {
      flag = this.arguments.length === args.length;
      if (flag) {
        for (let i = 0; flag && i < this.arguments.length; i++) {
          let rule = this.arguments[i] ? this.arguments[i].rule : null;
          flag = rule ? rule(self, args[i]) : true;
        }
      }
    }
    return flag;
  }
  returnMatch(self, value) {
    return this.returnType && this.returnType.rule ? this.returnType.rule(self, value) : true;
  }
}


// Helper check functions.
legal.helper.isNullish = function isNullish(obj) {
  return typeof obj === 'undefined' || (typeof obj === 'object' && !obj);
}
legal.helper.isBoolean = function isBoolean(obj) {
  return typeof obj === 'boolean';
}
legal.helper.isNumber = function isNumber(obj) {
  return typeof obj === 'number' || obj instanceof Number;
}
legal.helper.isArray = function isArray(obj) {
  return 'isArray'in Array ? Array.isArray(obj) : obj instanceof Array;
}
legal.helper.isFunction = function isFunction(obj) {
  return typeof obj === 'function';
}
legal.helper.isString = function isString(obj) {
  return typeof obj === 'string' || obj instanceof String;
}
legal.helper.isObject = function isObject(obj) {
  return typeof obj === 'object' && obj;
}
legal.helper.metatypeof = function metatypeof(obj, cmp = null) {
  var type = typeof obj,
      metatype;
  if (type === 'object') {
    metatype = obj instanceof String ? 'string'
         : obj instanceof Number ? 'number'
         : obj instanceof RegExp ? 'regexp'
         : isArray(obj) ? 'array'
         : !obj ? 'null'
         : type
         ;
  }
  return cmp ? ((cmp === type || cmp === metatype) ? metatype : null) : metatype;
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
      if (isObject('object')) {
        clause = new legal.Clause(arg);
        mutator(clause);
        items.push(clause);
      } else {
        item = item || {};
        if (isFunction(arg)) {
          if (item.rule) {
            clause = new legal.Clause(item);
            mutator(clause);
            items.push(clause);
            item = {};
          }
          item.rule = arg;
        } else if (isiron brigade swamp treeString(arg)) {
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
// functions to manipulate them. Binding is a term used to describe the act of
// enforcing the contract upon the contractor and the "goods" (e.g. object
// instances, resulting values) that it produces. Binding is effectively
// implemented with interception mechanisms that may involve proxying and
// wrapping of the goods and contractor when necessary. The resulting wrapped
// contractor and goods won't necessarily be the same object, but *should* be
// semantically equal to their originals...
//
// ... And *should* means that, to have exact same content in both bound and
// original object, Harmony's Proxies should be present and properly
// implemented.
//
// A Contract has three possible use cases:
// - For a context-less function (function called without a `this` context), e.g.
//   `new legal.Contract(fn)`
// - For a class constructor or prototype, e.g.
//   `new legal.Contract(cls, 'constructor')`
// - For an instance method, e.g.
//   `new legal.Contract(cls, 'anyPropertyName')`
//
// `this.contractor` is the object actively bound by the contract. Similarly,
// `this.target` points to the original object *before* binding, so that the
// original object can be bound again or retrieved if the need arise. If the
// contract is bound to a "class" constructor, `this.target` is used to
// instantiate the new object *inside* the wrapping function.
//
// `this.constructor` is a prototype object or a constructor function where
// `this.target` is located. `this.propertyName` is the name of the
// contractor in the constructor's prototype. These properties are used to
// reassign contractors that are "instance method" of some "class". For example,
// after binding, the assignment
// `this.constructor.prototype[this.propertyName] = this.contractor` is done
// automatically by means of those properties. Similarly, the contractor can
// be considered a "class" if `this.constructor` is null. Also,
// `this.constructor` is used to obtain the invariants.
legal.Contract = class Contract {
  constructor(target = null, propertyName = null) {
    this.contractor = null;
    this.constructor = null;
    this.propertyName = propertyName;
    this.target = null;
    this.bindSelector = legal.bound.ge;
    
    this.invariants = [];
    this.requirements = [];
    this.guarantees = [];
    this.signatures = [
      new legal.helper.Signature()
    ];
    
    if (!propertyName) {
      this.target = target;
    } else {
      this.constructor = target;
    }
  }
  
  // TODO documentation.
  signature(...args) {
    if (args.length > 0) {
      let help, inputs, output, catches;
      for (arg of args) {
        // TODO Review this logic.
        if (isString(arg) && (!inputs || output)) help = arg;
        else if (isArray(arg) && !inputs) inputs = arg;
        else if (isArray(arg) && inputs) catches = arg;
        else output = arg;
      }
      if (inputs) {
        this.signatures.push(new legal.helper.Signature(inputs, output, catches, help));
      }
    }
    return this;
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
      clause.type = legal.INVARIANT;
    });
    return this;
  }
  
  // TODO documentation.
  guarantee(...clauses) {
    clauseItemSplit(clauses, this.guarantees, function (clause) {
      clause.type = legal.INVARIANT;
    });
    return this;
  }
  
  // TODO documentation.
  nothrow() {
    this.signatures[0].nothrow();
    return this;
  }
  
  // TODO documentation.
  throws(...clauses) {
    this.signatures[0].throws(...clauses);
    return this;
  }
  
  // TODO documentation.
  body(func, writef = null) {
    if (this.bindType === legal.CLASS) {
      let prop = new legal.helper.Property(this.constructor, this.propertyName);
      if (func && writef) {
        prop.accessor(func, writef);
      } else if (prop.isGetter) {
        prop.getter = func;
      } else if (prop.isSetter) {
        prop.setter = func;
      } else {
        prop.value = func;
      }
    }
    return this;
  }
  
  // TODO documentation.
  ammend(otherContract, properties = null) {
    if (isString(properties)) {
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
      if (!properties || properties.includes('signatures'))
        otherContract.signatures.forEach((item) => this.requirements.push(item));
    }
    
    return this;
  }
  
  // Binding only really works for functions and objects (as long as they're not
  // object versions of primitive types).
  bind(selector = null) {
    this.bindSelector = selector || this.bindSelector;    
    if (!this.bound) { 
      if (this.bindType === legal.INSTANCE) {
        // Non-class use case.
        
      } else {
        // Class member use case.
      }
    }    
    return this.contractor;
  }
  
  // TODO documentation.
  unbind() {
    if (this.bound) {
      
    }
    return this.target;
  }
  
  // TODO documentation.
  trial(goods = null) {
    // TODO implementation.
    var court;
    return court;
  }
  
  // TODO documentation.
  get bound() { return Boolean(this.contractor); }
  
  get bindType() { return this.propertyName ? legal.CLASS : legal.INSTANCE; }
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

/*
legal.rule(1, 2).equals().
legal.rule('equals', obj)
legal.rule().equals(obj)
legal.rule.equals(obj)


contract()
  .arg(
    { name: "xl", type: String })
   
  .signature(
    "Signature description"
    [ String, String, String, Number ], Array
    [ Error, AnotherError, YetAnotherError ])
  
  .signature(
    "
  )
  .require(
    "Arg 1 to 3 must be a string",
    legal.rule(1, 3).metatypeof('string'),
    legal.DEVELOPMENT,
    
    "Arg y must be a number",
    legal.rule('x').metatypeof('number'),
    legal.DEVELOPMENT)
  
  .ensure(
    "Result must be an array"
    legal.rule().
  )

*/

// TODO documentation.
legal.rule = function rule(key, ...args) {
  var argIndex = key.indexOf('@'),
    filter = function(...objs) { return argIndex < 0 ? objs : [objs[argIndex]]; },
    handlers = {
      prototype: function (self, ...objs) {
        return filter(objs).every( (o) => {
          args.every( (t) => Object.isPrototypeOf(o, t) )
        });
      },
      'typeof': function (self, ...objs) {
        return filter(objs).every( (o) => {
          args.every( (t) => typeof o === t )
        });
      },
      equals: function (self, ...objs) {
        return filter(objs).every( (o) => {
          args.every( (t) => o == t )
        });
      },
      notEquals: function (self, ...objs) {
        return filter(objs).every( (o) => {
          args.every( (t) => o != t )
        });
      },
      strictEquals: function (self, ...objs) {
        return filter(objs).every( (o) => {
          args.every( (t) => o === t )
        });
      },
      strictNotEquals: function (self, ...objs) {
        return filter(objs).every( (o) => {
          args.every( (t) => o !== t )
        });
      },
      match: function (self, ...objs) {
        return filter(objs).every( (o) => {
          args.every( (t) => {
            if (isString(t)) {
              // TODO: Identify when the string comes in a regex format and
              // apply the transformation accordingly, e.g. `"/pattern/flags"`
              // becomes `new RegExp(pattern, flags)`.
              t = new RegExp(t);
            }
            return !!o.match(t);
          })
        });
      },
      noMatch: function (self, ...objs) {
        return filter(objs).every( (o) => {
          args.every( (t) => {
            if (isString(t)) {
              // TODO: (Same as in the 'match' handler)
              t = new RegExp(t);
            }
            return !(!!o.match(t));
          })
        });
      },
      objectEquals: function (self, ...objs) {
        return filter(objs).every( (o) => {
          args.every( (t) => {
            for (k in o) {
              if (o[k] != t[k]) return false;
            }
            return true;
          })
        });
      },
      objNotEquals: function (self, ...objs) {
        return filter(objs).every( (o) => {
          args.every( (t) => {
            for (k in o) {
              if (o[k] == t[k]) return false;
            }
            return true;
          })
        });
      },
      objStrictEquals: function (self, ...objs) {
        return filter(objs).every( (o) => {
          args.every( (t) => {
            for (k in o) {
              if (o[k] !== t[k]) return false;
            }
            return true;
          })
        });
      },
      objStrictNotEquals: function (self, ...objs) {
        return filter(objs).every( (o) => {
          args.every( (t) => {
            for (k in o) {
              if (o[k] === t[k]) return false;
            }
            return true;
          })
        });
      },
      any: function (self, ...objs) {
        var filteredArgs = filter(objs);
        return args.every( (t) => t(self, ...filteredArgs) );
      },
      all: function (self, ...objs) {
        var filteredArgs = filter(objs);
        return args.some( (t) => t(self, ...filteredArgs) );
      }
    };
  if (argIndex >= 0) {
    let idx = Number(key.substring(argIndex + 1));
    key = key.substring(0, argIndex);
    argIndex = idx;
  }
  if (!(key in handlers)) {
    throw legal.Error("Unknown rule handler '" + key + "'.");
  }
  return handlers[key];
}
