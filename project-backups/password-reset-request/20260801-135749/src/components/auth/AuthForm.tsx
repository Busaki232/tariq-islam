import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Turnstile } from "@marsidev/react-turnstile";
import { Capacitor } from "@capacitor/core";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Mail, Lock, User, Phone, MapPin } from "lucide-react";
import { TURNSTILE_SITE_KEY, isCaptchaEnabled } from "@/config/turnstile";
import { toast } from "sonner";

const signInSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

const signUpSchema = z
  .object({
    email: z.string().trim().email({ message: "Invalid email address" }),
    password: z.string().min(6, { message: "Password must be at least 6 characters" }),
    confirmPassword: z.string(),
    fullName: z.string().trim().min(2, { message: "Full name is required" }),
    phoneNumber: z.string().optional(),
    location: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type SignInFormData = z.infer<typeof signInSchema>;
type SignUpFormData = z.infer<typeof signUpSchema>;

export const AuthForm = () => {
  const [activeTab, setActiveTab] = useState("signin");
  const [showResendConfirmation, setShowResendConfirmation] = useState(false);
  const [signUpEmail, setSignUpEmail] = useState("");
  const { signIn, signUp, loading, resendConfirmation } = useAuth();

  // ✅ IMPORTANT: prevent first-render Turnstile load in native apps
  const [captchaEnabled, setCaptchaEnabled] = useState(() => !Capacitor.isNativePlatform());

  useEffect(() => {
    // Keep runtime check too (web builds + if you ever adjust detection logic)
    const enabled = !Capacitor.isNativePlatform() && isCaptchaEnabled();
    setCaptchaEnabled(enabled);
  }, []);

  const signInTurnstileRef = useRef<any>(null);
  const signUpTurnstileRef = useRef<any>(null);
  const [signInToken, setSignInToken] = useState<string>("");
  const [signUpToken, setSignUpToken] = useState<string>("");

  const signInForm = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const signUpForm = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      fullName: "",
      phoneNumber: "",
      location: "",
    },
  });

  const onSignIn = async (data: SignInFormData) => {
    const captchaRequired = !Capacitor.isNativePlatform() && isCaptchaEnabled();

    if (captchaRequired && !signInToken) {
      toast.error("Please complete the security verification");
      return;
    }

    await signIn(data.email, data.password, captchaRequired ? signInToken : undefined);

    if (captchaRequired) {
      signInTurnstileRef.current?.reset();
      setSignInToken("");
    }
  };

  const onSignUp = async (data: SignUpFormData) => {
    const captchaRequired = !Capacitor.isNativePlatform() && isCaptchaEnabled();

    if (captchaRequired && !signUpToken) {
      toast.error("Please complete the security verification");
      return;
    }

    const result = await signUp(
      data.email,
      data.password,
      data.fullName,
      data.phoneNumber,
      data.location,
      captchaRequired ? signUpToken : undefined
    );

    if (!result.error) {
      setSignUpEmail(data.email);
      setShowResendConfirmation(true);
    }

    if (captchaRequired) {
      signUpTurnstileRef.current?.reset();
      setSignUpToken("");
    }
  };

  const handleResendConfirmation = async () => {
    if (signUpEmail) await resendConfirmation(signUpEmail);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
      <div className="w-full max-w-md">
        <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-sm">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 bg-gradient-primary rounded-full mx-auto mb-4 flex items-center justify-center">
              <User className="text-white" size={32} />
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Welcome to Tariq Islam
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Join our Islamic community platform
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <Form {...signInForm}>
                  <form onSubmit={signInForm.handleSubmit(onSignIn)} className="space-y-4">
                    <FormField
                      control={signInForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Mail size={16} />
                            Email
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter your email"
                              type="email"
                              {...field}
                              disabled={loading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={signInForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Lock size={16} />
                            Password
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter your password"
                              type="password"
                              {...field}
                              disabled={loading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {captchaEnabled && (
                      <div className="my-4">
                        <p className="text-sm text-muted-foreground mb-2">Security Verification</p>
                        <Turnstile
                          ref={signInTurnstileRef}
                          siteKey={TURNSTILE_SITE_KEY}
                          onSuccess={(token) => setSignInToken(token)}
                          onError={() => setSignInToken("")}
                          onExpire={() => setSignInToken("")}
                          options={{
                            theme: "light",
                            size: "normal",
                            appearance: "always",
                          }}
                        />
                      </div>
                    )}

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                      <p className="text-sm text-amber-800">
                        <strong>Note:</strong> Make sure you've confirmed your email address before
                        signing in. Check your inbox for the confirmation link.
                      </p>
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-gradient-primary hover:opacity-90 shadow-islamic"
                      disabled={loading || (captchaEnabled && !signInToken)}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing In...
                        </>
                      ) : (
                        "Sign In"
                      )}
                    </Button>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="signup">
                <Form {...signUpForm}>
                  <form onSubmit={signUpForm.handleSubmit(onSignUp)} className="space-y-4">
                    <FormField
                      control={signUpForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <User size={16} />
                            Full Name
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your full name" {...field} disabled={loading} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={signUpForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Mail size={16} />
                            Email
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter your email"
                              type="email"
                              {...field}
                              disabled={loading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={signUpForm.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Phone size={16} />
                            Phone Number (Optional)
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter your phone number"
                              type="tel"
                              {...field}
                              disabled={loading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={signUpForm.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <MapPin size={16} />
                            Location (Optional)
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your location" {...field} disabled={loading} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={signUpForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Lock size={16} />
                            Password
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Create a password"
                              type="password"
                              {...field}
                              disabled={loading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={signUpForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Lock size={16} />
                            Confirm Password
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Confirm your password"
                              type="password"
                              {...field}
                              disabled={loading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {captchaEnabled && (
                      <div className="my-4">
                        <p className="text-sm text-muted-foreground mb-2">Security Verification</p>
                        <Turnstile
                          ref={signUpTurnstileRef}
                          siteKey={TURNSTILE_SITE_KEY}
                          onSuccess={(token) => setSignUpToken(token)}
                          onError={() => setSignUpToken("")}
                          onExpire={() => setSignUpToken("")}
                          options={{
                            theme: "light",
                            size: "normal",
                            appearance: "always",
                          }}
                        />
                      </div>
                    )}

                    {showResendConfirmation && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                        <h4 className="font-semibold text-green-800 mb-2">Check Your Email!</h4>
                        <p className="text-sm text-green-700 mb-3">
                          We've sent a confirmation link to <strong>{signUpEmail}</strong>. Please
                          check your inbox and click the link to verify your account.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleResendConfirmation}
                          disabled={loading}
                          className="w-full"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                              Resending...
                            </>
                          ) : (
                            "Resend Confirmation Email"
                          )}
                        </Button>
                      </div>
                    )}

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <p className="text-xs text-blue-800">
                        By creating an account, you'll receive an email confirmation. You must
                        verify your email before you can sign in.
                      </p>
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-gradient-primary hover:opacity-90 shadow-islamic"
                      disabled={loading || showResendConfirmation || (captchaEnabled && !signUpToken)}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating Account...
                        </>
                      ) : (
                        "Create Account"
                      )}
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};