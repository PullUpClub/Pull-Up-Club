import React, { useState, useEffect } from 'react';
import { User, Hash, Calendar, Users, Building, MapPin, Phone, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

const REGION_OPTIONS = [
  'North America',
  'South America',
  'Europe',
  'Asia',
  'Middle East',
  'Africa',
  'Australia/Oceania',
];

const ProfileSettings: React.FC = () => {
  const { user, profile, setProfile } = useAuth();
  const { t } = useTranslation('profile');
  const [formData, setFormData] = useState({
    fullName: '',
    socialMedia: '',
    age: '',
    gender: '',
    organization: '',
    region: '',
    phone: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        fullName: profile.full_name || '',
        socialMedia: profile.social_media || '',
        age: profile.age ? String(profile.age) : '',
        gender: profile.gender || '',
        organization: profile.organization || '',
        region: profile.region || '',
        phone: profile.phone || '',
      });
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const initial = {
      fullName: profile.full_name || '',
      socialMedia: profile.social_media || '',
      age: profile.age ? String(profile.age) : '',
      gender: profile.gender || '',
      organization: profile.organization || '',
      region: profile.region || '',
      phone: profile.phone || '',
    };
    setDirty(JSON.stringify(formData) !== JSON.stringify(initial));
  }, [formData, profile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setDirty(true);
  };

  const handleSavePersonalInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setIsSaving(true);
    try {
      const updateData = {
        full_name: formData.fullName,
        social_media: formData.socialMedia,
        age: parseInt(formData.age) || null,
        gender: formData.gender,
        organization: formData.organization,
        region: formData.region,
        phone: formData.phone,
        is_profile_completed: true,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);
      if (error) throw error;
      const { data: updated, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (fetchError) throw fetchError;
      if (setProfile && updated) {
        setProfile((prev) => prev ? {
          ...prev,
          full_name: updated.full_name,
          social_media: updated.social_media,
          age: updated.age,
          gender: updated.gender,
          organization: updated.organization,
          region: updated.region,
          phone: updated.phone,
          is_profile_completed: true,
        } : prev);
      }
      setDirty(false);
      toast.success(t('settings.updateSuccess'));
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(t('settings.updateError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-gray-900 p-6 rounded-lg text-center transform transition-transform hover:scale-105">
        <div className="flex items-center mb-6 justify-center">
          <Settings size={48} className="text-[#9b9b6f] mr-4" />
          <div className="text-left">
            <h3 className="text-xl font-bold text-white mb-2">{t('settings.title')}</h3>
            <p className="text-gray-400">{t('settings.subtitle')}</p>
          </div>
        </div>
        <form onSubmit={handleSavePersonalInfo} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center text-sm font-medium mb-2 text-[#9b9b6f]">
                <User className="w-4 h-4 mr-1" />
                {t('settings.fullName')}
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={handleInputChange}
                name="fullName"
                required
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-[#9b9b6f] focus:outline-none transition-colors"
                placeholder={t('settings.fullNamePlaceholder')}
              />
              <p className="text-gray-500 text-xs mt-1">{t('settings.fullNameDesc')}</p>
            </div>
            <div>
              <label className="flex items-center text-sm font-medium mb-2 text-[#9b9b6f]">
                <Hash className="w-4 h-4 mr-1" />
                {t('settings.socialMedia')}
              </label>
              <input
                type="text"
                value={formData.socialMedia}
                onChange={handleInputChange}
                name="socialMedia"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-[#9b9b6f] focus:outline-none transition-colors"
                placeholder={t('settings.socialMediaPlaceholder')}
              />
              <p className="text-gray-500 text-xs mt-1">{t('settings.socialMediaDesc')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="flex items-center text-sm font-medium mb-2 text-[#9b9b6f]">
                <Calendar className="w-4 h-4 mr-1" />
                {t('settings.age')}
              </label>
              <input
                type="number"
                value={formData.age}
                onChange={handleInputChange}
                name="age"
                required
                min="13"
                max="120"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-[#9b9b6f] focus:outline-none transition-colors"
                placeholder={t('settings.agePlaceholder')}
              />
            </div>
            <div>
              <label className="flex items-center text-sm font-medium mb-2 text-[#9b9b6f]">
                <Users className="w-4 h-4 mr-1" />
                {t('settings.gender')}
              </label>
              <select
                value={formData.gender}
                onChange={handleInputChange}
                name="gender"
                required
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-[#9b9b6f] focus:outline-none transition-colors"
              >
                <option value="">{t('settings.selectGender')}</option>
                <option value="Male">{t('settings.male')}</option>
                <option value="Female">{t('settings.female')}</option>
                <option value="Other">{t('settings.other')}</option>
              </select>
            </div>
            <div>
              <label className="flex items-center text-sm font-medium mb-2 text-[#9b9b6f]">
                <Building className="w-4 h-4 mr-1" />
                {t('settings.organization')}
              </label>
              <input
                type="text"
                value={formData.organization}
                onChange={handleInputChange}
                name="organization"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-[#9b9b6f] focus:outline-none transition-colors"
                placeholder={t('settings.organizationPlaceholder')}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center text-sm font-medium mb-2 text-[#9b9b6f]">
                <MapPin className="w-4 h-4 mr-1" />
                {t('settings.region')}
              </label>
              <select
                value={formData.region}
                onChange={handleInputChange}
                name="region"
                required
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-[#9b9b6f] focus:outline-none transition-colors"
              >
                <option value="">{t('settings.selectRegion')}</option>
                {REGION_OPTIONS.map((region) => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center text-sm font-medium mb-2 text-[#9b9b6f]">
                <Phone className="w-4 h-4 mr-1" />
                {t('settings.phone')}
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={handleInputChange}
                name="phone"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-[#9b9b6f] focus:outline-none transition-colors"
                placeholder={t('settings.phonePlaceholder')}
              />
            </div>
          </div>
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSaving || !dirty}
              className="w-full bg-[#9b9b6f] hover:bg-[#a5a575] disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {isSaving ? t('settings.savingButton') : t('settings.saveButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileSettings; 