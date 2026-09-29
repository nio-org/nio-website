---
title: "Function values and closures"
description: "Functions in Nio are values. A program can write them inline, keep them in variables, pass and return them, and capture variables in closures."
---

# Function values

Functions in Nio are values. A program can create them without a name, keep them in variables, pass them to other functions, return them from functions, and store them in record fields and arrays.

## Function types

A function type gives the parameter types in parentheses and the return type in angle brackets. `<void>` marks a function that returns nothing:

```nio
Function(int)<int> f;                 // takes an int, returns an int
Function()<void> task;                // takes nothing, returns nothing
Function(int, String)<bool> check;
Function(int)<int>[] pipeline;        // array of function values
Function()<int>? maybe;               // optional function value
Function(int, ...String)<void> log;   // variadic
```

Two function types are the same type when their parameter lists and return types are the same. A function type can be used anywhere that a type can be used: in variables, parameters, return types, record fields, array elements and optionals.

The `...` on a last parameter is part of the type. `Function(...String)<void>` and `Function(String[])<void>` are *different* types, although both bodies bind a `String[]`. Only a call of the first type collects its arguments into an array.

## Writing a function value

A function value has the form of a function declaration without the name, with `->` before the body. As in a declaration, the return type at the start is necessary. It is `void` when the value returns nothing:

```nio
Function(int)<int> double = int (int x) -> x * 2;        // expression body
Function()<void> hello = void () -> { print("hi"); };    // block body

print(double(21));      // 42
hello();                // hi
```

`-> expression` returns the expression. `-> { ... }` is an ordinary function body. It uses `return`, as a declared function does. Parameters always have a type.

The compiler does not infer the return type from the body or from the variable that holds the value. `void (int x) -> x * 2` calculates `x * 2` and discards it. `int (int x) -> x * 2` returns it. If the return type does not match the type that is expected, the compiler shows an error.

Any expression that holds a function value can be called: a variable (`f(2)`), a record field (`h.run(2)`), an array element (`funcs[0](2)`) or the result of another call (`makeAdder(1)(2)`).

The last parameter can be [variadic](/docs/basics#variadic-parameters), as in a declaration:

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

A function value can use the variables around it. It *captures them by reference*: the function value and the enclosing code share the variable, and each side sees the assignments of the other. This stays true after the enclosing function has returned:

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

Each call to `counter()` creates a new `n`. Two counters do not affect each other.

In loops, a `forEach` binding is new for each iteration, but a `for` counter is one variable for the whole loop:

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

Module-level variables are not captured. A function value reads and writes them directly, as any function body does.

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

The name of a *declared* function is not a value yet. As a result, `apply(add, 1)` is a compile error. The call goes in a function value instead: `apply(int (int x) -> add(x, 1), 2)`. The same rule applies to a [method](/docs/basics#methods). The function value also holds the value that the method is called on: `apply(int (int x) -> myCar.age(x), 2026)`.

## Function fields and methods

Both add behavior to a record, for different purposes.

A function-typed **field** holds a value. It can be different in each record. Examples are a comparator, a retry hook, or a callback that the code supplies when it builds the record. The field holds a closure. It captures the variables around the place where it was written. It cannot read the other fields of the record that holds it.

```nio
type Job {
    String name;
    Function()<void> onDone;      // varies per job
}
```

A [method](/docs/basics#methods) belongs to the type. All values of the type share it. It reads and writes the value that it was called on through `self`. It uses no storage in the record, and the code that builds a value does not supply it:

```nio
type Job {
    String name;

    void describe() {
        print("job " + self.name);
    }
}
```

A method is the correct choice when the behavior is the same for all values of the type. A field is the correct choice when the caller supplies the behavior as data.

## Other rules

* The zero value of a function type is a null function. A call to a null function is a runtime error: `Function()<void> f; f();` stops the program. A program assigns a value before the call, or it uses `Function()<void>?` and [narrows](/docs/basics#optionals-t) it before the call:

```nio
Function()<void>? task;
if (task != null) {
    task();
}
```

* Function values cannot be compared with `==` or printed, and they have no JSON form. A function value in a [record field](/docs/stdlib/json#function-typed-fields) is not included in the output. `json.toText` rejects a function value that is passed directly, or inside an array or an optional.
* After `->`, a `{` always starts a block body. An expression body that returns a record literal must put it in parentheses: `Car () -> ({ make: "a", age: 1 })`.
* Closures are garbage collected, like all other values on the heap. A captured variable stays alive while a function value can reach it.
