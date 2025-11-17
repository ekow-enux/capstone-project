import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema({
    // Polymorphic reference: can reference either EmergencyAlert or Incident
    data_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, 'Data ID is required'],
        refPath: 'data_type'
    },
    // The model type being referenced
    data_type: {
        type: String,
        enum: ['EmergencyAlert', 'Incident'],
        required: [true, 'Data type is required']
    },
    // Station that is referring
    from_station_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Station',
        required: [true, 'From station is required']
    },
    // Station that is receiving the referral
    to_station_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Station',
        required: [true, 'To station is required']
    },
    reason: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending'
    },
    referred_at: {
        type: Date,
        default: Date.now
    },
    responded_at: {
        type: Date,
        default: null
    },
    response_notes: {
        type: String,
        trim: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual to populate the referenced data (alert or incident)
referralSchema.virtual('referenced_data', {
    refPath: 'data_type',
    localField: 'data_id',
    foreignField: '_id',
    justOne: true
});

// Indexes for efficient queries
referralSchema.index({ data_id: 1, data_type: 1 });
referralSchema.index({ from_station_id: 1 });
referralSchema.index({ to_station_id: 1 });
referralSchema.index({ status: 1 });
referralSchema.index({ to_station_id: 1, status: 1 });

export default mongoose.model('Referral', referralSchema);

