const assert = require('assert');
const Bitpack = require('../index');
const rand = require('random-seed').create('shieldsbetter bitpack');

const packTests = [
    {
        writes: [],
        expected: '00000000000000000000000000000000'
    },
    {
        writes: [''],
        expected: '00000000000000000000000000000000'
    },
    {
        writes: ['1'],
        expected: '80000000000000000000000000000000'
    },
    {
        writes: ['01'],
        expected: '40000000000000000000000000000000'
    },
    {
        writes: ['0110 1'],
        expected: '68000000000000000000000000000000'
    },
    {
        writes: ['0110 1011'],
        expected: '6b000000000000000000000000000000'
    },
    {
        writes: ['0110 1011 1'],
        expected: '6b800000000000000000000000000000'
    },
    {
        writes: ['0110 1011 1111 0101'],
        expected: '6bf50000000000000000000000000000'
    },
    {
        writes: ['0110 1011 1111 0101 01'],
        expected: '6bf54000000000000000000000000000'
    },
    {
        writes: ['0110 1011 1111 0101 0100 1110'],
        expected: '6bf54e00000000000000000000000000'
    },
    {
        writes: ['0110 1011 1111 0101 0100 1110 101'],
        expected: '6bf54ea0000000000000000000000000'
    },
    {
        writes: ['0110 1011 1111 0101 0100 1110 1010 1101'],
        expected: '6bf54ead000000000000000000000000'
    },
    {
        writes: ['0', '1', '1', '0', '1', '0', '1', '1', '1'],
        expected: '6b800000000000000000000000000000'
    },
    {
        writes: ['0110 1011', '1111 0101', '0100 1110', '1010 1101'],
        expected: '6bf54ead000000000000000000000000'
    },
    {
        writes: ['0110 1011 1111 0101 0100 1110 1010 110', '1 1111 0001'],
        expected: '6bf54eadf10000000000000000000000'
    }
];

assert.equal(
        new Bitpack('128 bits').getAvailableFreeBits(), 128,
        'constructor should accept string data length descriptor');

assert.equal(
        new Bitpack(Bitpack.bits(128)).getAvailableFreeBits(), 128,
        'constructor should accept pre-constructed data length object');

{
    const pack = new Bitpack('32 bits');
    pack.pack(0x12345, '20 bits');
    
    assert.equal(pack.getAvailableFreeBits(), 12,
            'pack() should accept string data length descriptor');
}

{
    const pack = new Bitpack('32 bits');
    pack.pack(0x12345, Bitpack.bits(20));
    
    assert.equal(pack.getAvailableFreeBits(), 12,
            'pack() should accept pre-constructed data length object');
}

{
    const pack = new Bitpack('32 bits');
    pack.pack('1010 1010 1010 1010 1010');
    
    assert.equal(pack.getAvailableFreeBits(), 12,
            'pack() should accept binary string');
}

{
    const pack = new Bitpack('32 bits');
    pack.pack('1010 1010 1010 1010 1010');
    
    const dest = Buffer.alloc(4);
    pack.copy(dest, '1 octets');
    
    assert.equal(dest.toString('hex'), '00aaaaa0', 'copy() should accept an ' +
            'offset as a string data length descriptor: ' +
            dest.toString('hex'));
}

{
    const pack = new Bitpack('32 bits');
    pack.pack('1010 1010 1010 1010 1010');
    
    const dest = Buffer.alloc(4);
    pack.copy(dest, '0 octets');
    
    assert.equal(dest.toString('hex'), 'aaaaa000', 
            'copy() should work with a zero offset');
}

{
    const pack = new Bitpack('32 bits');
    pack.pack('1010 1010 1010 1010 1010');
    
    const dest = Buffer.alloc(4);
    pack.copy(dest);
    
    assert.equal(dest.toString('hex'), 'aaaaa000', 
            'copy() should work with an ommitted offset');
}

{
    const pack = new Bitpack('32 bits');
    
    const dest = Buffer.alloc(4);
    pack.copy(dest);
    
    assert.equal(dest.toString('hex'), '00000000', 
            'copy() should work with zero data');
}

{
    const pack = new Bitpack('32 bits');
    pack.pack('1010 1010 1010 1010 1010');
    
    const dest = Buffer.alloc(4);
    pack.copy(dest, Bitpack.octets(1));
    
    assert.equal(dest.toString('hex'), '00aaaaa0', 'copy() should accept an ' +
            'offset as a pre-compiled data length object: ' +
            dest.toString('hex'));
}

{
    const pack = new Bitpack('32 bits');
    const dest = Buffer.alloc(4);

    try {
        pack.copy(dest, Bitpack.bits(3));
        assert.fail('it is an error to attempt to offset copy() by a ' +
                'non-integral number of octets');
    }
    catch (e) {
        if (!e.illegalArgument) {
            throw e;
        }
    }
}

{
    const pack = new Bitpack('32 bits');
    const dest = Buffer.alloc(4);

    try {
        pack.copy(dest, Bitpack.octets(-3));
        assert.fail('it is an error to attempt to offset copy() by a ' +
                'negative number of octets');
    }
    catch (e) {
        if (!e.illegalArgument) {
            throw e;
        }
    }
}

{
    const pack = new Bitpack('32 bits');
    pack.pack('1010 1010 1010 1010 1010');
    const dest = Buffer.alloc(4);

    try {
        pack.copy(dest, '2 octets');
        assert.fail('destination buffer must have enough space');
    }
    catch (e) {
        if (!e.bufferTooSmall) {
            throw e;
        }
    }
}

{
    const pack = new Bitpack('32 bits');
    pack.pack(0b11111101, Bitpack.bits(2));

    assert.equal(pack.bitfield.toString('hex'), '40000000',
            'pack() only writes the requested bits');
}

{
    const pack = new Bitpack('32 bits');

    try {
        pack.pack('1010 1010   1010 1010   1010 1010   1010 1010   1');
        assert.fail('it is an error to try to pack more than 32 bits at once');
    }
    catch (e) {
        if (!e.illegalArgument) {
            throw e;
        }
    }
}

{
    const pack = new Bitpack('32 bits');

    try {
        pack.pack(0, Bitpack.bits(-3));
        assert.fail('it is an error to try to pack a negative number of bits');
    }
    catch (e) {
        if (!e.illegalArgument) {
            throw e;
        }
    }
}

{
    const pack = new Bitpack('32 bits');

    try {
        pack.pack(0);
        assert.fail('it is an error to omit the data length when the value ' +
                'is a number');
    }
    catch (e) {
        if (!e.illegalArgument) {
            throw e;
        }
    }
}

{
    const pack = new Bitpack('32 bits');
    pack.pack('1010 1010   1010 1010   1010 1010   1010 ');

    try {
        pack.pack('1010   1010');
        assert.fail('internal buffer must have enough space');
    }
    catch (e) {
        if (!e.bufferTooSmall) {
            throw e;
        }
    }
}

{
    const pack = new Bitpack('32 bits');
    pack.pack('1010 1010   1010 1010   1010 1010   1010 ');

    try {
        pack.pack({});
        assert.fail('it is an error for pack\'s first arg to be something ' +
                'other than a string or number');
    }
    catch (e) {
        if (!e.illegalArgument) {
            throw e;
        }
    }
}

{
    const length1 = Bitpack.bits(16).ct;
    const length2 = Bitpack.octets(2).ct;
    const length3 = Bitpack.dataLength('16 bits').ct;
    const length4 = Bitpack.dataLength('2 octets').ct;
    const length5 = Bitpack.dataLength('16 bit').ct;
    const length6 = Bitpack.dataLength('2 octet').ct;
    
    assert(length1 === 16, 'bits() works');
    assert(length2 === 16, 'octets() works');
    assert(length3 === 16, 'dataLength("... bits") works');
    assert(length4 === 16, 'dataLength("... octets") works');
    assert(length5 === 16, 'dataLength("... bit") works');
    assert(length6 === 16, 'dataLength("... octet") works');
}

{
    try {
        Bitpack.dataLength('x y z');
        assert.fail('it is in error to have more than two fields in a ' +
                'string data-length descriptor')
    }
    catch (e) {
        if (!e.cannotParse) {
            throw e;
        }
    }
}

{
    try {
        Bitpack.dataLength('x');
        assert.fail('it is in error to have less than two fields in a ' +
                'string data-length descriptor')
    }
    catch (e) {
        if (!e.cannotParse) {
            throw e;
        }
    }
}

{
    try {
        Bitpack.dataLength('');
        assert.fail('it is in error to have zero fields in a ' +
                'string data-length descriptor')
    }
    catch (e) {
        if (!e.cannotParse) {
            throw e;
        }
    }
}

{
    try {
        Bitpack.dataLength('1.2 octets');
        assert.fail('it is in error to have a non-integral count in a ' +
                'string data-length descriptor')
    }
    catch (e) {
        if (!e.cannotParse) {
            throw e;
        }
    }
}

{
    try {
        Bitpack.dataLength('xyz octets');
        assert.fail('it is in error to have a non-number count in a ' +
                'string data-length descriptor')
    }
    catch (e) {
        if (!e.cannotParse) {
            throw e;
        }
    }
}

{
    try {
        Bitpack.dataLength('5 bytes');
        assert.fail('it is in error to have an unrecognized unit in a ' +
                'string data-length descriptor')
    }
    catch (e) {
        if (!e.cannotParse) {
            throw e;
        }
    }
}

packTests.forEach((test, testNumber) => {
    const bufferToTest = new Bitpack('128 bits');
    test.writes.forEach(bitDescription => {
        bitDescription = bitDescription.replace(/ /g, '');
        
        const value = parseInt(bitDescription, 2);
        bufferToTest.pack(value, Bitpack.bits(bitDescription.length));
    });
    
    const expectedBuffer = Buffer.from(test.expected, 'hex');
    
    if (bufferToTest.bitfield.compare(expectedBuffer) !== 0) {
        console.log('not the same on Test ' + testNumber);
        console.log('expected: ' + expectedBuffer.toString('hex'));
        console.log('found:    ' + bufferToTest.bitfield.toString('hex'));
        
        throw new Error();
    }
});

{
    // Fuzz test!
    
    const bufferToTest = new Bitpack('128 bits');
    const goldenBuffer = [];
    let goldenCursor = 0;

    for (let i = 0; i < 128; i++) {
        goldenBuffer.push(0);
    }

    let toWrite = [];
    for (let i = 0; i < 32; i++) {
        toWrite.push(0);
    }

    for (let i = 0; i < 10000; i++) {
        let writeCt = rand(32) + 1;

        if (writeCt > bufferToTest.getAvailableFreeBits()) {
            bufferToTest.clear();
            for (let j = 0; j < goldenBuffer.length; j++) {
                goldenBuffer[j] = 0;
            }
            goldenCursor = 0;
        }

        let toWriteNum = 0;
        for (let j = 0; j < writeCt; j++) {
            toWrite[j] = rand(2);
            
            toWriteNum = toWriteNum << 1;
            toWriteNum = toWriteNum | toWrite[j];
        }
        
        let result = '';
        for (let j = 0; j < writeCt; j++) {
            result += toWrite[j];
            
            if (j % 4 === 3) {
                result += ' ';
            }
        }
        result = result.trim();
        
        bufferToTest.pack(toWriteNum, writeCt + ' bits');
        
        for (let j = 0; j < writeCt; j++) {
            goldenBuffer[goldenCursor] = toWrite[j];
            goldenCursor++;
            
            if (goldenCursor === 128) {
                goldenCursor = 0;
            }
        }
        
        const actual = Buffer.alloc(128 / 8);
        bufferToTest.copy(actual, '0 bits');
        
        let goldenRealBuffer = toBuffer(goldenBuffer);
        if (actual.compare(goldenRealBuffer) !== 0) {
            console.log('not the same');
            console.log('Expecting: ' + goldenRealBuffer.toString('hex'));
            console.log('Actually:  ' + actual.toString('hex'));
            
            throw new Error();
        }
    }
}

console.log('All tests passed.');

// ############################################################################
// ## Helper methods                                                         ##
// ############################################################################

function concatArray(a) {
    let result = '';
    a.forEach(ae => result += ae);
    
    return result;
}

function toBuffer(a) {
    let result = Buffer.alloc(128 / 8);
    
    let cursor = 0;
    while (cursor < 128 / 8) {
        let value = 0;
        for (let i = 0; i < 8; i++) {
            value = value << 1;
            value = value | a[(cursor * 8) + i];
        }
        
        result.writeUInt8(value, cursor);
        
        cursor++;
    }
    
    return result;
}

function bin(input) {
    return Number.parseInt(input.replace(/\s/g, ''), 2);
}
