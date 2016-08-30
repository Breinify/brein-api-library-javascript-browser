## User Field Documentation

Breinify supports various user properties that you can include in the analytics.

### Example of full user info

```javascript
var user = {
    'EMAIL':'johndoe@gmail.com',
    'FIRSTNAME':'John',
    'LASTNAME':'Doe',
    'DATEOFBIRTH': new Date(1985,6,30),
    'DEVICEID' : 'AAAAAAAAA-BBBB-CCCC-1111-222222220000',
    'MD5EMAIL' : '761cd16b141770ecb0bbb8a4e5962d16',
    'SESSIONID' : 'SID:ANON:w3.org:j6oAOxCWZ'
}
```

### Fields

#### Email

Attribute key: `EMAIL`

Example value: `johndoe@gmail.com`

Description: The email address of the current user, if known.

#### First Name

Attribute key: `FIRSTNAME`

Example value: `John`

Description: The first name of the current user, if known.

#### Last Name

Attribute String: `LASTNAME`

Example: `Doe`

Description: The last name of the current user, if known.

#### Date of Birth

Attribute key: `DATEOFBIRTH`

Example value: `new Date(1985, 6, 30)`

Description: The email address of the current user, if known.

#### Device ID

Attribute key: `DEVICEID`

Example value: `AAAAAAAAA-BBBB-CCCC-1111-222222220000`

Description: The current user's device's id, if known.

#### MD5 Email

Attribute key: `MD5EMAIL`

Example value: `761cd16b141770ecb0bbb8a4e5962d16`

Description: A hashed version of the user's email address.


#### Session ID

Attribute key: `SESSIONID`

Example value: `SID:ANON:w3.org:j6oAOxCWZ`

Description: The user's [Session Id](https://en.wikipedia.org/wiki/Session_ID).



/*
     * Overview of all the different properties available for a user.
     */
    attributes.add('EMAIL', {
        name: 'email',
        group: 1,
        optional: false
    });
    attributes.add('FIRSTNAME', {
        name: 'firstName',
        group: 2,
        optional: false
    });
    attributes.add('LASTNAME', {
        name: 'lastName',
        group: 2,
        optional: false
    });
    attributes.add('DATEOFBIRTH', {
        name: 'dateOfBirth',
        group: 2,
        optional: false
    });
    attributes.add('DEVICEID', {
        name: 'deviceId',
        group: 3,
        optional: false
    });
    attributes.add('MD5EMAIL', {
        name: 'md5Email',
        group: 4,
        optional: false
    });
    attributes.add('SESSIONID', {
        name: 'sessionId',
        group: 5,
        optional: false
    });