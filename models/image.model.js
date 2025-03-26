import mongoose from 'mongoose';

const imageSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    imageUrl: {
        type: String,
        required: true
    },
    thumbnailUrl: {
        type: String,
        required: true
    },
    source: {
        type: String,
        required: true
    },
    link: {
        type: String,
        required: true
    },
    originalUrl: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    explanation: {
        type: {
            explanation: String,
            responseId: String,
            usage: {
                prompt_tokens: Number,
                completion_tokens: Number,
                total_tokens: Number
            }
        },
        required: false
    }
});

const Image = mongoose.model('Image', imageSchema);

export default Image;
