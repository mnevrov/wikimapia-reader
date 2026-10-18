package org.example.wikimapreader;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Versioned authenticated ciphertext. No Android dependency, exercised by JVM tests. */
public final class CredentialCipher {
    private static final byte[] AAD="org.example.wikimapreader:wikimapia-api:v1".getBytes(StandardCharsets.UTF_8);
    private CredentialCipher() {}
    public static byte[] encrypt(String value,SecretKey key) throws GeneralSecurityException {
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE,key); // Provider generates a fresh nonce; never reuse one.
        cipher.updateAAD(AAD);
        byte[] iv=cipher.getIV();
        if(iv.length!=12)throw new GeneralSecurityException("Unsupported nonce");
        byte[] encrypted=cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
        byte[] result=new byte[1+iv.length+encrypted.length];result[0]=1;
        System.arraycopy(iv,0,result,1,iv.length);
        System.arraycopy(encrypted,0,result,13,encrypted.length);return result;
    }
    public static String decrypt(byte[] record,SecretKey key) throws GeneralSecurityException {
        if(record.length<29||record[0]!=1)throw new GeneralSecurityException("Invalid record");
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE,key,new GCMParameterSpec(128,Arrays.copyOfRange(record,1,13)));
        cipher.updateAAD(AAD);
        return new String(cipher.doFinal(record,13,record.length-13),StandardCharsets.UTF_8);
    }
}
