package org.example.wikimapreader;
import org.junit.Test;
import static org.junit.Assert.*;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import java.security.GeneralSecurityException;
import java.util.Arrays;

public class CredentialCipherTest {
    private SecretKey key() throws Exception { KeyGenerator g=KeyGenerator.getInstance("AES");g.init(256);return g.generateKey(); }
    @Test public void roundTripAndRandomNonce() throws Exception {
        SecretKey k=key();byte[] one=CredentialCipher.encrypt("test-key-ключ",k),two=CredentialCipher.encrypt("test-key-ключ",k);
        assertEquals("test-key-ключ",CredentialCipher.decrypt(one,k));assertFalse(Arrays.equals(one,two));
        assertFalse(new String(one,java.nio.charset.StandardCharsets.UTF_8).contains("test-key"));
    }
    @Test public void rejectsTamperingAndWrongKey() throws Exception {
        SecretKey k=key();byte[] data=CredentialCipher.encrypt("secret",k);data[data.length-1]^=1;
        assertThrows(GeneralSecurityException.class,()->CredentialCipher.decrypt(data,k));
        assertThrows(GeneralSecurityException.class,()->CredentialCipher.decrypt(CredentialCipher.encrypt("secret",k),key()));
    }
    @Test public void rejectsTruncatedAndUnsupportedRecord() throws Exception {
        SecretKey k=key();assertThrows(GeneralSecurityException.class,()->CredentialCipher.decrypt(new byte[4],k));
        byte[] data=CredentialCipher.encrypt("secret",k);data[0]=99;
        assertThrows(GeneralSecurityException.class,()->CredentialCipher.decrypt(data,k));
    }
}
