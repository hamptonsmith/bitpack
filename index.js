'use strict';

const SBError = require('@shieldsbetter/sberror');

const BufferTooSmall = SBError.subtype('BufferTooSmall', 'Insufficient space ' +
        'in {{bufferDescription}}.  Available bits: {{availableBits}} bits ' +
        '(from offset {{offsetBits}}), Required bits: {{requiredBits}}.');
const CannotParse = SBError.subtype('CannotParse', `
    Couldn't parse "{{input}}" from {{sourceDescription}}, expected 
    {{expectedFormat}}
    
    {{#problemDescription}}
        , but {{problemDescription}}
    {{/problemDescription}}.
`);
const IllegalArgument = SBError.subtype('IllegalArgument', 
        '{{argumentDescription}} must be {{predicateDescription}}, but was: ' +
        '{{providedValue}}.');

module.exports = class {
    constructor(bufferSize) {
        const bufferSizeBits = dataLengthArg(bufferSize, 'bufferSize');
    
        this.bitfield = Buffer.alloc(Math.ceil(bufferSizeBits / 8));
        this.bitfieldCursor = 0;
    }
    
    copy(dest, destOffset) {
        if (!destOffset) {
            destOffset = new BitCount(0);
        }
    
        const destOffsetBits = dataLengthArg(destOffset, 'destOffset');
        if (destOffsetBits % 8 !== 0) {
            throw new IllegalArgument({
                argumentDescription: 'Argument destOffset',
                predicateDescription: 'an integral number of octets',
                providedValue: destOffsetBits + ' bits'
            });
        }
    
        if (destOffsetBits < 0) {
            throw new IllegalArgument({
                argumentDescription: 'Argument destOffset',
                predicateDescription: 'non-negative',
                providedValue: destOffsetBits + ' bits'
            });
        }
    
        const destOffsetOctet = destOffsetBits / 8;
        if (destOffsetOctet + Math.ceil(this.bitfieldCursor / 8) >
                dest.length) {
            throw new BufferTooSmall({
                bufferDescription: 'destination buffer',
                availableBits: (dest.length * 8) - (destOffsetOctet * 8),
                offsetBits: destOffsetOctet * 8,
                requiredBits: this.bitfieldCursor
            });
        }
        
        this.bitfield.copy(
                dest, destOffsetOctet, 0, Math.ceil(this.bitfieldCursor / 8));
    }
    
    getAvailableFreeBits() {
        return (this.bitfield.length * 8) - this.bitfieldCursor;
    }
    
    clear() {
        this.bitfieldCursor = 0;
    }
    
    pack() {
        let [value, bitsToCopy] = doPackArgs(arguments);
    
        if (bitsToCopy > 32) {
            throw new IllegalArgument({
                argumentDescription: 'Argument dataLength',
                predicateDescription: '32 bits or less',
                providedValue: bitsToCopy
            });
        }
        
        if (bitsToCopy < 0) {
            throw new IllegalArgument({
                argumentDescription: 'Argument dataLength',
                predicateDescription: 'non-negative',
                providedValue: bitsToCopy
            });
        }
    
        if (bitsToCopy === 0) {
            return;
        }
        
        if (this.bitfieldCursor + bitsToCopy > (this.bitfield.length * 8)) {
            throw new BufferTooSmall({
                bufferDescription: 'internal buffer',
                availableBits: (this.bitfield.length * 8 - this.bitfieldCursor),
                offsetBits: this.bitfieldCursor,
                requiredBits: bitsToCopy
            });
        }
        
        initializeAhead.call(this, bitsToCopy);
    
        value = value & (0xFFFFFFFF >>> (32 - bitsToCopy));
        
        // First, let's get to a byte boundary.
        if (this.bitfieldCursor % 8 !== 0) {
            bitsToCopy = completeOctet.call(this, value, bitsToCopy);
        }
        
        // Now that we're at a byte boundary, let's copy over as many integral
        // internal bytes as we have.
        while (bitsToCopy > 8) {
            const valueOctetToCopy = (value >>> (bitsToCopy - 8)) & 0xFF;
            
            this.bitfield.writeUInt8(valueOctetToCopy, this.bitfieldCursor / 8);
            
            bitsToCopy -= 8;
            this.bitfieldCursor += 8;
        }
        
        // Finally let's deal with any trailing bits.
        if (bitsToCopy > 0) {
            // Let's position however many trailing bits we have.
            const trailingBits =
                    (value & (0xFF >> (8 - bitsToCopy))) << (8 - bitsToCopy);
            
            const bitfieldOctetCursor = this.bitfieldCursor / 8;
            let curData = this.bitfield.readUInt8(bitfieldOctetCursor);
            
            curData = curData & (0xFF >>> bitsToCopy) | trailingBits;
            
            this.bitfield.writeUInt8(curData, bitfieldOctetCursor);
            
            this.bitfieldCursor += bitsToCopy;
        }
    }
}

function dataLength(input) {
    let result;

    switch (typeof input) {
        case 'string': {
            const inputParts = input.trim().split(' ');
            
            if (inputParts.length !== 2) {
                throw new CannotParse({
                    input: `"${input}"`,
                    sourceDescription: 'input argument',
                    expectedFormat: 'two tokens: a number and a unit ' +
                            'specifier, separated by space',
                    problemDescription: (inputParts.length > 2) ?
                            'there were too many tokens' :
                            'not enough tokens',
                    actualTokenCount: input === '' ? 0 : inputParts.length
                });
            }
            
            const [numberString, unitString] = inputParts;
            const number = Number.parseFloat(numberString);
            
            if (Number.isNaN(number)) {
                throw new CannotParse({
                    input: input,
                    sourceDescription: 'input argument',
                    expectedFormat: 'a number',
                    problemDescription: `found "${numberString}"`
                });
            }
            
            if (Math.floor(number) !== number) {
                throw new CannotParse({
                    input: input,
                    sourceDescription: 'input argument',
                    expectedFormat: 'an integral number',
                    problemDescription: `got ${number}`
                });
            }
            
            const multiplier =
                    {bit: 1, bits: 1, octet: 8, octets: 8}[unitString];
            if (!multiplier) {
                throw new CannotParse({
                    input: input,
                    sourceDescription: 'input argument',
                    expectedFormat: 'either "bits" or "octets"',
                    problemDescription: `found "${unitString}"`
                });
            }
            
            result = Object.freeze(new BitCount(number * multiplier));
            break;
        }
        case 'object': {
            if (input === null) {
                throw new IllegalArgument({
                    argumentDescription: 'Argument input',
                    predicateDescription: 'non-null',
                    providedValue: input
                });
            }
            
            if (!(input instanceof BitCount)) {
                throw new IllegalArgument({
                    argumentDescription: 'Argument input',
                    predicateDescription: 'a data-length description or a ' +
                            'data-length object derived from Bitpack.bits(), ' +
                            'Bitpack.octets(), or Bitpack.dataLength()',
                    providedValue: input
                });
            }
            
            result = input;
            break;
        }
        default: {
            throw new IllegalArgument({
                argumentDescription: 'Argument input',
                predicateDescription: 'a data-length description or a ' +
                        'data-length object derived from Bitpack.bits(), ' +
                        'Bitpack.octets(), or Bitpack.dataLength()',
                providedValue: input
            });
            
            break;
        }
    }
    
    return result;
}

function dataLengthArg(input, argumentName) {
    try {
        return dataLength(input).ct;
    }
    catch (e) {
        SBError.switch(e, {
            CannotParse: () => {
                e.details.sourceDescrption = argumentName + ' argument';
                throw new CannotParse(e.details);
            },
            IllegalArgument: () => {
                e.details.argumentDescription = 'Argument ' + argumentName;
                throw new IllegalArgument(e.details);
            }
        });
    }
}

module.exports.bits = bitCt => Object.freeze(new BitCount(bitCt));
module.exports.octets = octetCt => Object.freeze(new BitCount(octetCt * 8));
module.exports.dataLength = dataLength;

class BitCount {
    constructor(ct) {
        this.ct = ct;
    }
}

function completeOctet(value, availableBits) {
    const bitsToFill = 8 - (this.bitfieldCursor % 8);
    const bitsToWrite = Math.min(bitsToFill, availableBits);
    
    const shift = availableBits - bitsToFill;
    let positionedValueBits;
    if (shift > 0) {
        positionedValueBits = value >>> shift;
    }
    else {
        positionedValueBits = value << -shift;
    }
    
    let curData =
            this.bitfield.readUInt8(Math.floor(this.bitfieldCursor / 8));
    
    const writeMask =
            (0xFF >>> (8 - bitsToWrite)) << (bitsToFill - bitsToWrite);
    curData = curData & ~writeMask | positionedValueBits;
    
    this.bitfield.writeUInt8(curData, Math.floor(this.bitfieldCursor / 8));
    
    this.bitfieldCursor += bitsToWrite;
    return availableBits - bitsToWrite;
}

function initializeAhead(bitsToCopy) {
    let zeroStart, zeroLength;
    if (this.bitfieldCursor % 8 === 0) {
        // We haven't started writing to this byte yet, so we need to zero
        // it.
        zeroStart = Math.floor(this.bitfieldCursor / 8);
        zeroLength = Math.ceil((this.bitfieldCursor + bitsToCopy) / 8) -
                zeroStart;
    }
    else {
        // We already wrote to this byte some, so it better have already
        // been zeroed.
        zeroStart = Math.floor(this.bitfieldCursor / 8) + 1;
        zeroLength =
                Math.ceil((this.bitfieldCursor + bitsToCopy) / 8) -
                    zeroStart;
    }
    
    // Why is this specified as a requirement?  Shame on node!
    if (zeroLength > 0) {
        this.bitfield.writeUIntLE(0, zeroStart, zeroLength);
    }
}

function doPackArgs(args) {
    let value;
    let bitsToCopy;

    switch (typeof args[0]) {
        case 'number': {
            value = args[0];
            bitsToCopy = dataLengthArg(args[1], 'dataLength');
            break;
        }
        case 'string': {
            args[0] = args[0].replace(/\s/g, '');
        
            value = parseInt(args[0], 2);
            bitsToCopy = args[0].length;
            break;
        }
        default: {
            throw new IllegalArgument({
                argumentDescription: 'First argument to pack()',
                predicateDescription: 'a number or a string containing the ' +
                        'bits to be written',
                providedValue: args[0]
            });
        }
    }
    
    return [value, bitsToCopy];
}
