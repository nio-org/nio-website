---
title: "Quickstart"
description: "Learn the core of Nio in a few complete programs: variables, records, functions, async code, errors, files and optional values."
---

# Quickstart

```nio
import 'string';
import 'time';

type User {
    String name;
    int visits;
}

String heading = "Nio quickstart";  // initialized normally
int attempts;                       // uninitialized: the int zero value is 0
int? selectedId = null;             // optional values may be null

String formatName(String value) {
    // Strings are immutable, so the modified text is returned.
    return string.toUpperCaseAscii(string.trim(value));
}

String async fetchName(int id) {
    await time.sleep(25);

    if (id < 0) {
        return Error("id cannot be negative");
    }
    return "Ada";
}

User user = {
    name: formatName("  ada  "),
    visits: attempts
};

// Calling an async function returns a Future immediately.
Future<String!> pending = fetchName(-1);

// The error is produced when the future is awaited.
String? fetchedName = await pending catch e {
    print("fetch failed: " + e.message);
};

print(heading);            // Nio quickstart
print(user.name);          // ADA
print(user.visits);        // 0
print(selectedId);         // null
print(fetchedName);        // null
```

Nio programs run from top to bottom; there is no required `main` function. Save the example as `hello.nio` and run it with:

```sh
nio run hello.nio
```

Functions become fallible automatically when they return an `Error` or call another fallible function. There is no error marker on `fetchName`; the `!` appears only in the `Future<String!>` type used to store the call.

## Reading and writing a file

File contents are byte arrays. Use the `string` module when the contents are text.

```nio
import 'fs';
import 'string';

fs.writeFile(
    "message.txt",
    string.toByteArray("hello from Nio\n")
) catch e {
    print("write failed: " + e.message);
};

byte[]? content = fs.readFile("message.txt") catch e {
    print("read failed: " + e.message);
};

if (content != null) {
    print(string.fromByteArray(content));
}
```

See the [`fs` reference](/docs/stdlib/fs) for directories, metadata, temporary directories, and deletion.

## Extending a record

`extends` copies a record's fields and methods into another type. Use `override` to replace an inherited method.

```nio
type Vehicle {
    String make;

    int wheels() {
        return 4;
    }

    void describe() {
        print(self.make, "has", self.wheels(), "wheels");
    }
}

type Truck extends Vehicle {
    int load;

    int override wheels() {
        return 6;
    }
}

Vehicle car = { make: "toyota" };
Truck truck = { make: "volvo", load: 900 };

car.describe();           // toyota has 4 wheels
truck.describe();         // volvo has 6 wheels
print(truck.load);        // 900
```

The two declarations still name distinct types: a `Truck` is not automatically assignable to a `Vehicle`. See [Extending a type](/docs/basics#extending-a-type) for the complete rules.

## Narrowing an optional

After a null check, the compiler narrows `T?` to `T` inside the branch.

```nio
import 'string';

String? findNickname(bool found) {
    if (!found) {
        return null;
    }
    return "ace";
}

String? nickname = findNickname(true);

if (nickname != null) {
    // nickname is a String here, not String?.
    print(string.toUpperCaseAscii(nickname));   // ACE
} else {
    print("no nickname");
}
```

See [Optionals](/docs/basics#optionals-t) for optional chaining and other narrowing patterns.
