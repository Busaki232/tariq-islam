import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, BookOpen, Users, Shield, Phone, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AntiExtremismEducation = () => {
  const navigate = useNavigate();

  const resources = [
    {
      icon: Heart,
      title: 'Islam is Peace',
      content: 'Learn about the true teachings of Islam, which emphasize peace, compassion, and respect for all life.',
      verses: [
        'Whoever kills an innocent soul, it is as if he has killed all of humanity. (Quran 5:32)',
        'There is no compulsion in religion. (Quran 2:256)'
      ]
    },
    {
      icon: BookOpen,
      title: 'Understanding Jihad',
      content: 'The concept of jihad is often misunderstood. The greatest jihad is the struggle against one\'s own negative desires.',
      verses: [
        'The best jihad is the one against your own self and desires. (Prophet Muhammad ﷺ)',
        'Invite to the way of your Lord with wisdom and good instruction. (Quran 16:125)'
      ]
    },
    {
      icon: Users,
      title: 'Coexistence and Tolerance',
      content: 'Islam teaches us to live peacefully with people of all faiths and backgrounds.',
      verses: [
        'O mankind, indeed We have created you from male and female and made you peoples and tribes that you may know one another. (Quran 49:13)',
        'For you is your religion, and for me is my religion. (Quran 109:6)'
      ]
    },
    {
      icon: Shield,
      title: 'Protecting the Innocent',
      content: 'Islam strictly forbids harming innocent people and places great emphasis on preserving life.',
      verses: [
        'And do not kill the soul which Allah has forbidden, except by right. (Quran 17:33)',
        'Allah does not forbid you from dealing kindly and fairly with those who have not fought nor driven you out of your homes. (Quran 60:8)'
      ]
    }
  ];

  const helplines = [
    {
      organization: 'Prevent Helpline (UK)',
      number: '0800 011 3764',
      description: 'Confidential advice and support for those concerned about radicalization'
    },
    {
      organization: 'FBI Tips (USA)',
      number: '1-800-CALL-FBI',
      description: 'Report suspicious activities anonymously'
    },
    {
      organization: 'Crisis Text Line',
      number: 'Text HOME to 741741',
      description: 'Free 24/7 crisis support via text message'
    }
  ];

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <div className="text-center mb-8">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-orange-600" />
          <h1 className="text-4xl font-bold mb-2">Educational Resources</h1>
          <p className="text-lg text-muted-foreground">
            Understanding Islam's True Message of Peace
          </p>
        </div>

        <Card className="mb-8 border-orange-600 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="pt-6">
            <p className="text-center font-medium">
              If you or someone you know is being influenced by extremist ideologies, 
              please seek help immediately. There are resources available to support you.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6 mb-8">
          {resources.map((resource, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <resource.icon className="w-6 h-6 text-islamic-green" />
                  <CardTitle>{resource.title}</CardTitle>
                </div>
                <CardDescription>{resource.content}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 p-4 rounded-md space-y-2">
                  {resource.verses.map((verse, i) => (
                    <p key={i} className="text-sm italic text-foreground">
                      "{verse}"
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Get Help & Support
            </CardTitle>
            <CardDescription>
              If you have concerns about radicalization or extremism
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {helplines.map((helpline, index) => (
              <div key={index} className="border-l-4 border-islamic-green pl-4">
                <h3 className="font-semibold">{helpline.organization}</h3>
                <p className="text-lg font-medium text-islamic-green">{helpline.number}</p>
                <p className="text-sm text-muted-foreground">{helpline.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                Our community is built on the principles of peace, understanding, and mutual respect. 
                Let's work together to combat extremism and build a better future.
              </p>
              <div className="flex gap-4 justify-center">
                <Button onClick={() => navigate('/community-guidelines')}>
                  <BookOpen className="w-4 h-4 mr-2" />
                  Community Guidelines
                </Button>
                <Button variant="outline" onClick={() => navigate('/')}>
                  Return Home
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AntiExtremismEducation;
