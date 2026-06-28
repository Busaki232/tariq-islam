-- Create table for Islamic holidays and important dates
CREATE TABLE public.islamic_holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_arabic TEXT,
  hijri_month INTEGER NOT NULL CHECK (hijri_month >= 1 AND hijri_month <= 12),
  hijri_day INTEGER NOT NULL CHECK (hijri_day >= 1 AND hijri_day <= 30),
  description TEXT,
  significance TEXT,
  is_major_holiday BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.islamic_holidays ENABLE ROW LEVEL SECURITY;

-- Allow everyone to view Islamic holidays (public information)
CREATE POLICY "Anyone can view Islamic holidays"
ON public.islamic_holidays
FOR SELECT
USING (true);

-- Insert major Islamic holidays
INSERT INTO public.islamic_holidays (name, name_arabic, hijri_month, hijri_day, description, significance, is_major_holiday) VALUES
('Islamic New Year', 'رأس السنة الهجرية', 1, 1, 'The first day of Muharram, marking the beginning of the Islamic lunar calendar year.', 'Commemorates the Hijrah (migration) of Prophet Muhammad from Mecca to Medina.', true),
('Day of Ashura', 'يوم عاشوراء', 1, 10, 'A day of fasting and remembrance on the 10th of Muharram.', 'Commemorates various events including the day Moses was saved from Pharaoh, and the martyrdom of Imam Hussain.', true),
('Mawlid al-Nabi', 'المولد النبوي', 3, 12, 'Birthday of Prophet Muhammad (peace be upon him).', 'Celebration of the birth of the Prophet, observed by many Muslims worldwide.', true),
('Laylat al-Miraj', 'ليلة المعراج', 7, 27, 'The Night Journey and Ascension of Prophet Muhammad.', 'Commemorates the Prophet''s miraculous journey from Mecca to Jerusalem and ascension to heaven.', true),
('Laylat al-Bara''ah', 'ليلة البراءة', 8, 15, 'The Night of Forgiveness, middle of Sha''ban.', 'A night of worship and seeking forgiveness before Ramadan.', false),
('First Day of Ramadan', 'أول رمضان', 9, 1, 'Beginning of the holy month of fasting.', 'Start of the most sacred month in Islam, month of fasting, prayer, and reflection.', true),
('Laylat al-Qadr', 'ليلة القدر', 9, 27, 'The Night of Power, one of the last ten nights of Ramadan.', 'The night the Quran was first revealed, better than a thousand months.', true),
('Eid al-Fitr', 'عيد الفطر', 10, 1, 'Festival of Breaking the Fast.', 'Major celebration marking the end of Ramadan, one of two major Islamic holidays.', true),
('Day of Arafah', 'يوم عرفة', 12, 9, 'The most important day of Hajj pilgrimage.', 'Day of standing at Mount Arafat, a day of forgiveness and mercy.', true),
('Eid al-Adha', 'عيد الأضحى', 12, 10, 'Festival of Sacrifice.', 'Major celebration commemorating Prophet Ibrahim''s willingness to sacrifice his son, one of two major Islamic holidays.', true);

-- Create index for faster queries
CREATE INDEX idx_islamic_holidays_month_day ON public.islamic_holidays(hijri_month, hijri_day);
CREATE INDEX idx_islamic_holidays_major ON public.islamic_holidays(is_major_holiday) WHERE is_major_holiday = true;