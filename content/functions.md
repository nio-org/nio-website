---
title: "Function values and closures"
description: "Functions in Nio are values: write them inline, keep them in variables, pass and return them, and capture variables in closures."
---

# Function values

Functions in Nio are values: you can create them anonymously, keep them in variables, pass them to and return them from other functions, and store them in record fields and arrays.

## Function types

A function type spells out the parameter types in parentheses and the return type in angle brackets; `<void>` marks a function that returns nothing:

```nio
Function(int)<int> f;                 // takes an int, returns an int
Function()<void> task;                // takes nothing, returns nothing
Function(int, String)<bool> check;
Function(int)<int>[] pipeline;        // array of function values
Function()<int>? maybe;               // optional function value
Function(int, ...String)<void> log;   // variadic
```

Two function types are the same exactly when their parameter lists and return types are the same. A function type can appear anywhere a type can — variables, parameters, return types, record fields, array elements, optionals.

The `...` on a last parameter is part of the type. `Function(...String)<void>` and `Function(String[])<void>` are *different* types, even though both bodies bind a `String[]` — only a call of the first one collects its arguments.

## Writing a function value

A function value looks like a function declaration without the name, with `->` before the body. As in declarations, the leading return type is required, and is `void` when the value returns nothing:

```nio
Function(int)<int> double = int (int x) -> x * 2;        // expression body
Function()<void> hello = void () -> { print("hi"); };    // block body

print(double(21));      // 42
hello();                // hi
```

`-> expression` returns the expression. `-> { ... }` is an ordinary function body: use `return` inside it, exactly as in a declared function. Parameters are always typed.

Watch the return type: it is never inferred, neither from the body nor from the slot the value goes into. `void (int x) -> x * 2` computes `x * 2` and throws it away; `int (int x) -> x * 2` returns it. The compiler will point out the mismatch if you pick the wrong one.

Anything holding a function value can be called: a variable (`f(2)`), a record field (`h.run(2)`), an array element (`funcs[0](2)`), even another call's result (`makeAdder(1)(2)`).

The last parameter can be [variadic](/docs/basics#variadic-parameters), exactly as in a declaration:

```nio
Function(...String)<void> shout = void (...String parts) -> {
    forEach(parts, p) {
        print(p + "!");
    }
};

shout("a", "b");        // a!  b!
shout();                // prints nothing
```

## Closures

A function value can use the variables around it. It *captures them by reference*: the function value and its surroundings share the variable, and each side sees the other's assignments — even after the enclosing function has returned:

```nio
Function()<int> counter() {
    int n = 0;
    return int () -> {
        n = n + 1;      // updates the one shared n
        return n;
    };
}

Function()<int> c = counter();
print(c());           // 1
print(c());           // 2
```

Each call to `counter()` creates a fresh `n`, so two counters never interfere.

Two loop details worth knowing:

```nio
import 'array';

Function()<int>[] fns = [];
forEach([10, 20, 30], e) {
    array.push(fns, int () -> e);     // forEach bindings are per iteration
}
print(fns[0]());      // 10
print(fns[2]());      // 30

Function()<int>[] shared = [];
for (int k = 0; k < 3; k++) {
    array.push(shared, int () -> k);  // one k for the whole loop
}
print(shared[0]());   // 3 — every closure shares the same k
```

Module-level variables are not captured; a function value reads and writes them directly, like any function body does.

## Passing and returning functions

```nio
int apply(Function(int)<int> f, int x) {
    return f(x);
}

Function(int)<int> makeAdder(int a) {
    return int (int b) -> a + b;
}

print(apply(int (int n) -> n * n, 7));  // 49
print(makeAdder(40)(2));                // 42
```

A *declared* function's name is not a value yet — `apply(add, 1)` is a compile error. Wrap it: `apply(int (int x) -> add(x, 1), 2)`. The same goes for a [method](/docs/basics#methods), where the wrapper also remembers which value to call it on: `apply(int (int x) -> myCar.age(x), 2026)`.

## Function fields or methods?

Both put behavior on a record, and they answer different questions.

A function-typed **field** holds a value, so it can differ from one record to the next — a comparator, a retry hook, a callback handed in at construction. Being a closure, it captures the variables around where it was written and knows nothing about the record it ends up in: a field cannot read its own record's other fields.

```nio
type Job {
    String name;
    Function()<void> onDone;      // varies per job
}
```

A [method](/docs/basics#methods) belongs to the type. Every value of the type shares it, it reads and writes the value it was called on through `self`, it costs the record no storage, and it never has to be filled in when a value is built:

```nio
type Job {
    String name;

    void describe() {
        print("job " + self.name);
    }
}
```

Rule of thumb: if the behavior is the same for every value of the type, make it a method; if the behavior is data the caller supplies, make it a field.

## The fine print

* The zero value of a function type is a null function; calling it is a runtime error (`Function()<void> f; f();` stops the program). Assign before calling, or use `Function()<void>?` and [narrow](/docs/basics#optionals-t) before the call:

```nio
Function()<void>? task;
if (task != null) {
    task();
}
```

* Function values cannot be compared with `==` or printed, and they have no JSON form. As a [record field](/docs/stdlib/json#function-typed-fields) one is simply omitted from the output; `json.toText` still rejects a function passed on its own, or inside an array or optional.
* After `->`, a `{` always starts a block body. To return a record literal from an expression body, parenthesize it: `Car () -> ({ make: "a", age: 1 })`.
* Like everything else on the heap, closures are garbage collected: a captured variable lives as long as some function value can still reach it.
