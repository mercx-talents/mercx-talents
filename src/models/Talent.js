const mongoose = require('mongoose');

const talentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true, maxlength: 100 },
  slug: { type: String, unique: true },
  description: { type: String, required: true, maxlength: 3000 },
  category: { type: String, required: true, enum: ['Web Development','Mobile Apps','Graphic Design','Digital Marketing','Content Writing','Video & Animation','UI/UX Design','Data & AI','SEO','Social Media','Music & Audio','Translation','Other'] },
  subcategory: String,
  skills: [String],
  tags: [String],
  pricing: {
    basic: { name: { type: String, default: 'Basic' }, description: String, price: { type: Number, required: true }, deliveryDays: { type: Number, required: true }, revisions: { type: Number, default: 1 }, features: [String] },
    standard: { name: { type: String, default: 'Standard' }, description: String, price: Number, deliveryDays: Number, revisions: { type: Number, default: 3 }, features: [String] },
    premium: { name: { type: String, default: 'Premium' }, description: String, price: Number, deliveryDays: Number, revisions: { type: Number, default: -1 }, features: [String] }
  },
  gallery: [{ url: String, publicId: String, caption: String }],
  faq: [{ question: String, answer: String }],
  requirements: String,
  status: { type: String, enum: ['active', 'paused', 'draft', 'suspended'], default: 'active' },
  rating: { average: { type: Number, default: 0 }, count: { type: Number, default: 0 } },
  orders: { completed: { type: Number, default: 0 }, inProgress: { type: Number, default: 0 } },
  views: { type: Number, default: 0 },
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  featured: { type: Boolean, default: false },
  approved: { type: Boolean, default: true }
}, { timestamps: true });

talentSchema.index({ title: 'text', description: 'text', skills: 'text', tags: 'text' });
talentSchema.index({ category: 1, 'rating.average': -1 });
talentSchema.index({ 'pricing.basic.price': 1 });
talentSchema.index({ slug: 1 });

module.exports = mongoose.model('Talent', talentSchema);
