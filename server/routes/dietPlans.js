const express = require('express');
const mongoose = require('mongoose');
const DietPlan = require('../models/DietPlan');
const User = require('../models/User');
const { isNonEmptyString } = require('../utils/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);
function toList(v) { if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean); if (!isNonEmptyString(v)) return []; return String(v).split(/\r?\n|,/).map(x => x.trim()).filter(Boolean); }

router.post('/', requireRole('doctor'), async (req,res)=>{
  try {
    const { patientId,title,condition,status,breakfast,lunch,dinner,foodsToInclude,foodsToAvoid,hydration,lifestyle,notes }=req.body||{};
    const errors={};
    const patient=isNonEmptyString(patientId)&&mongoose.isValidObjectId(patientId)?await User.findOne({_id:patientId,role:'patient'}):null;
    if(!isNonEmptyString(patientId)) errors.patientId='A patient must be selected.'; else if(!patient) errors.patientId='Selected patient was not found.';
    if(!isNonEmptyString(title)) errors.title='A plan title is required.';
    if(Object.keys(errors).length) return res.status(400).json({ok:false,errors});
    const plan=await DietPlan.create({patientId:patient._id,patientName:patient.name,patientEmail:patient.email,doctorId:req.user._id,doctorName:req.user.name,title:title.trim(),condition:String(condition||'').trim(),status:status==='inactive'?'inactive':'active',meals:{breakfast:toList(breakfast),lunch:toList(lunch),dinner:toList(dinner)},foodsToInclude:toList(foodsToInclude),foodsToAvoid:toList(foodsToAvoid),hydration:String(hydration||'').trim(),lifestyle:toList(lifestyle),notes:String(notes||'').trim()});
    return res.status(201).json({ok:true,plan});
  } catch(err){console.error(err);return res.status(500).json({ok:false,error:'Unable to create diet plan.'});}
});
router.get('/', async(req,res)=>{try{const q=req.user.role==='doctor'?{doctorId:req.user._id}:{patientId:req.user._id};if(req.user.role==='doctor'&&req.query.patientId&&mongoose.isValidObjectId(req.query.patientId))q.patientId=req.query.patientId;const plans=await DietPlan.find(q).sort({createdAt:-1});return res.json({ok:true,plans});}catch(err){return res.status(500).json({ok:false,error:'Unable to load diet plans.'});}});
router.get('/:id', async(req,res)=>{try{if(!mongoose.isValidObjectId(req.params.id))return res.status(404).json({ok:false,error:'Diet plan not found.'});const plan=await DietPlan.findById(req.params.id);if(!plan)return res.status(404).json({ok:false,error:'Diet plan not found.'});const allowed=(req.user.role==='doctor'&&plan.doctorId.equals(req.user._id))||(req.user.role==='patient'&&plan.patientId.equals(req.user._id));if(!allowed)return res.status(403).json({ok:false,error:'You do not have permission to view this plan.'});return res.json({ok:true,plan});}catch(err){return res.status(500).json({ok:false,error:'Unable to load diet plan.'});}});
router.patch('/:id',requireRole('doctor'),async(req,res)=>{try{if(!mongoose.isValidObjectId(req.params.id))return res.status(404).json({ok:false,error:'Diet plan not found.'});const p=await DietPlan.findById(req.params.id);if(!p)return res.status(404).json({ok:false,error:'Diet plan not found.'});if(!p.doctorId.equals(req.user._id))return res.status(403).json({ok:false,error:'You can only edit plans you authored.'});const {title,condition,status,breakfast,lunch,dinner,foodsToInclude,foodsToAvoid,hydration,lifestyle,notes}=req.body||{};const errors={};if(title!==undefined){if(!isNonEmptyString(title))errors.title='Plan title cannot be empty.';else p.title=title.trim();}if(condition!==undefined)p.condition=String(condition).trim();if(status!==undefined)p.status=status==='inactive'?'inactive':'active';if(hydration!==undefined)p.hydration=String(hydration).trim();if(notes!==undefined)p.notes=String(notes).trim();if(breakfast!==undefined)p.meals.breakfast=toList(breakfast);if(lunch!==undefined)p.meals.lunch=toList(lunch);if(dinner!==undefined)p.meals.dinner=toList(dinner);if(foodsToInclude!==undefined)p.foodsToInclude=toList(foodsToInclude);if(foodsToAvoid!==undefined)p.foodsToAvoid=toList(foodsToAvoid);if(lifestyle!==undefined)p.lifestyle=toList(lifestyle);if(Object.keys(errors).length)return res.status(400).json({ok:false,errors});await p.save();return res.json({ok:true,plan:p});}catch(err){return res.status(500).json({ok:false,error:'Unable to update diet plan.'});}});
router.delete('/:id',requireRole('doctor'),async(req,res)=>{try{if(!mongoose.isValidObjectId(req.params.id))return res.status(404).json({ok:false,error:'Diet plan not found.'});const p=await DietPlan.findById(req.params.id);if(!p)return res.status(404).json({ok:false,error:'Diet plan not found.'});if(!p.doctorId.equals(req.user._id))return res.status(403).json({ok:false,error:'You can only delete plans you authored.'});await p.deleteOne();return res.json({ok:true,message:'Diet plan deleted.'});}catch(err){return res.status(500).json({ok:false,error:'Unable to delete diet plan.'});}});
module.exports=router;
